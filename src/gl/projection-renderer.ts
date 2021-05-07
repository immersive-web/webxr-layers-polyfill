/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { XRView, XRViewport } from 'webxr'
import XRProjectionLayer from '../api/XRProjectionLayer'
import { XRSessionWithLayer } from '../api/XRSessionWithLayer'
import {
	PolyfillTexture,
	XRLayerLayout,
	XRTextureType,
	XRViewportPolyfill,
	XRWebGLRenderingContext,
} from '../types'
import { initializeViewport } from '../utils/initialize-viewport'
import { LayerRenderer } from './base-renderer'
import { applyVAOExtension, createProgram, setRectangle, VAOFunctions } from './webgl-utils'

// template tagging for syntax highlight
const glsl = (x) => x

const vertexShader = glsl`
attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
   // convert the rectangle from pixels to 0.0 to 1.0
   vec2 zeroToOne = a_position;

   // convert from 0->1 to 0->2
   vec2 zeroToTwo = zeroToOne * 2.0;

   // convert from 0->2 to -1->+1 (clipspace)
   vec2 clipSpace = zeroToTwo - 1.0;

   gl_Position = vec4(clipSpace * vec2(1, 1), 0, 1);

   // pass the texCoord to the fragment shader
   // The GPU will interpolate this value between points.
   v_texCoord = a_texCoord;
}
`

const fragmentShader = glsl`
precision mediump float;

// our texture
uniform sampler2D u_image;

// the texCoords passed in from the vertex shader.
varying vec2 v_texCoord;

void main() {
   	vec4 tex = texture2D(u_image, v_texCoord);
	gl_FragColor = vec4(tex.rgb, tex.a);
}
`

type ProjectionRendererProgramInfo = {
	attribLocations: {
		a_position: number
		a_texCoord: number
	}
}

class ProjectionRenderer implements LayerRenderer {
	protected gl: XRWebGLRenderingContext

	protected program: WebGLProgram

	protected layer: XRProjectionLayer
	protected vaoGl: VAOFunctions
	protected vao: WebGLVertexArrayObject | WebGLVertexArrayObjectOES

	protected programInfo: ProjectionRendererProgramInfo

	// we need references to the texturePoints and texCoordBuffer since
	// we may use different coordinates when rendering stereo textures
	private texturePoints: Float32Array
	private texcoordBuffer: WebGLBuffer
	private stereoTexturePoints: Float32Array[]

	constructor(layer: XRProjectionLayer, context: XRWebGLRenderingContext) {
		this.gl = context
		this.layer = layer
		this.program = createProgram(this.gl, vertexShader, fragmentShader)

		this.programInfo = {
			attribLocations: {
				a_position: this.gl.getAttribLocation(this.program, 'a_position'),
				a_texCoord: this.gl.getAttribLocation(this.program, 'a_texCoord'),
			},
		}

		this._createVAOs()
	}

	public render(session: XRSessionWithLayer) {
		let gl = this.gl

		let baseLayer = session.getBaseLayer()
		gl.viewport(0, 0, baseLayer.framebufferWidth, baseLayer.framebufferHeight)

		// get texture type of layer
		const textureType = this.layer.getTextureType()

		if (textureType === XRTextureType.texture) {
			gl.bindTexture(gl.TEXTURE_2D, this.layer.colorTextures[0])

			// Set the parameters so we can render any size image.
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
		} else {
			throw new Error(`Created a texture projection renderer instead of a texture-array projection renderer for a texture-array layer. 
This is probably an error with the polyfill itself; please file an issue on Github if you run into this.`)
		}

		for (let view of session.internalViews) {
			let viewport = baseLayer.getViewport(view)
			gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height)

			if (this._shouldUseStereoTexturePoints()) {
				this._renderInternalStereo(view)
			} else {
				this._renderInternal()
			}
		}
		gl.bindTexture(gl.TEXTURE_2D, null)
	}

	_renderInternal() {
		let gl = this.gl
		gl.useProgram(this.program)
		this.vaoGl.bindVertexArray(this.vao)

		// Draw the rectangle.
		var primitiveType = gl.TRIANGLES
		var offset = 0
		var count = 6
		gl.drawArrays(primitiveType, offset, count)

		this.vaoGl.bindVertexArray(null)
	}

	// this is used only for stereo-left-right and stereo-top-bottom layers, and is used to render
	// a part of a texture to a view.
	_renderInternalStereo(view: XRView) {
		if (view.eye === 'none') {
			return this._renderInternal()
		}
		let gl = this.gl
		this.vaoGl.bindVertexArray(this.vao)

		// Tell it to use our program (pair of shaders)
		gl.useProgram(this.program)

		// set position array and texture array
		// we have to set the texture buffer data for every eye
		this._setStereoTextureBuffer(view.eye === 'right' ? 1 : 0)

		// Draw the shape
		var primitiveType = gl.TRIANGLES
		var offset = 0
		var count = 6
		gl.drawArrays(primitiveType, offset, count)

		this.vaoGl.bindVertexArray(null)
	}

	_createVAOs() {
		this._createTextureUVs()
		let gl = this.gl

		// makes sure that VAOs are usable on both WebGL1 and WebGL2
		this.vaoGl = applyVAOExtension(gl)

		// position
		let positionBuffer = gl.createBuffer()
		this.vao = this.vaoGl.createVertexArray()

		this.vaoGl.bindVertexArray(this.vao)
		gl.enableVertexAttribArray(this.programInfo.attribLocations.a_position)

		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
		setRectangle(gl, 0, 0, 1.0, 1.0)

		// Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
		let size = 2 // 2 components per iteration
		let type = gl.FLOAT // the data is 32bit floats
		let normalize = false // don't normalize the data
		let stride = 0 // 0 = move forward size * sizeof(type) each iteration to get the next position
		let offset = 0 // start at the beginning of the buffer
		gl.vertexAttribPointer(
			this.programInfo.attribLocations.a_position,
			size,
			type,
			normalize,
			stride,
			offset
		)

		// textures
		this.texcoordBuffer = gl.createBuffer()

		gl.enableVertexAttribArray(this.programInfo.attribLocations.a_texCoord)
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoordBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, this.texturePoints, gl.DYNAMIC_DRAW)

		// we can reset size, type, etc. here, but for projection
		// layers they are the same between texture and position.
		gl.vertexAttribPointer(
			this.programInfo.attribLocations.a_texCoord,
			size,
			type,
			normalize,
			stride,
			offset
		)

		this.vaoGl.bindVertexArray(null)
		gl.bindBuffer(gl.ARRAY_BUFFER, null)
	}

	_setStereoTextureBuffer(index: number) {
		let gl = this.gl
		gl.enableVertexAttribArray(this.programInfo.attribLocations.a_texCoord)

		// bind the texcoord buffer.
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoordBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, this.stereoTexturePoints[index], gl.STATIC_DRAW)

		// Tell the texcoord attribute how to get data out of texcoordBuffer (ARRAY_BUFFER)
		var size = 2 // 2 components per iteration
		var type = gl.FLOAT // the data is 32bit floats
		var normalize = false // don't normalize the data
		var stride = 0 // 0 = move forward size * sizeof(type) each iteration to get the next position
		var offset = 0 // start at the beginning of the buffer
		gl.vertexAttribPointer(
			this.programInfo.attribLocations.a_texCoord,
			size,
			type,
			normalize,
			stride,
			offset
		)
		gl.bindBuffer(gl.ARRAY_BUFFER, null)
	}

	_createTextureUVs() {
		this.texturePoints = new Float32Array([
			0.0,
			0.0,
			1.0,
			0.0,
			0.0,
			1.0,
			0.0,
			1.0,
			1.0,
			0.0,
			1.0,
			1.0,
		])

		// calculate stereo layers if needed
		const viewport: XRViewportPolyfill = {
			x: 0,
			y: 0,
			width: 1,
			height: 1,
		}

		if (this._shouldUseStereoTexturePoints()) {
			this.stereoTexturePoints = []

			initializeViewport(viewport, this.layer.colorTexturesMeta[0], this.layer.layout, 0, 2)
			this.stereoTexturePoints[0] = this._offsetTextureUVsByRect(
				this.layer.colorTexturesMeta[0],
				this.texturePoints,
				viewport
			)

			initializeViewport(viewport, this.layer.colorTexturesMeta[0], this.layer.layout, 1, 2)
			this.stereoTexturePoints[1] = this._offsetTextureUVsByRect(
				this.layer.colorTexturesMeta[0],
				this.texturePoints,
				viewport
			)
		}
	}

	// used in stereo-left-right and stereo-top-down layers to obtain UVs on a part of a texture
	_offsetTextureUVsByRect(
		texture: PolyfillTexture,
		inArray: Float32Array,
		textureRect?: XRViewport
	): Float32Array {
		textureRect = textureRect ?? {
			x: 0,
			y: 0,
			width: texture.width,
			height: texture.height,
		}

		const uX = textureRect.x / texture.width
		const vY = textureRect.y / texture.height
		const uW = textureRect.width / texture.width
		const vH = textureRect.height / texture.height

		const outArray = []

		for (let i = 0; i < inArray.length; i += 2) {
			let u = inArray[i]
			let v = inArray[i + 1]

			let newU = u * uW + uX
			let newV = v * vH + vY

			outArray[i] = newU
			outArray[i + 1] = newV
		}

		return new Float32Array(outArray)
	}

	_shouldUseStereoTexturePoints(): boolean {
		return (
			this.layer.layout === XRLayerLayout['stereo-left-right'] ||
			this.layer.layout === XRLayerLayout['stereo-top-bottom']
		)
	}
}

const texArrayVertexShader = glsl`#version 300 es

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
	// convert the rectangle from pixels to 0.0 to 1.0
	vec2 zeroToOne = a_position;

	// convert from 0->1 to 0->2
	vec2 zeroToTwo = zeroToOne * 2.0;
 
	// convert from 0->2 to -1->+1 (clipspace)
	vec2 clipSpace = zeroToTwo - 1.0;
 
	gl_Position = vec4(clipSpace * vec2(1, 1), 0, 1);
 
	// pass the texCoord to the fragment shader
	// The GPU will interpolate this value between points.
	v_texCoord = a_texCoord;
}
`

const texArrayFragmentShader = glsl`#version 300 es
precision mediump float;
precision mediump int;
precision mediump sampler2DArray;

uniform sampler2DArray u_image;
uniform int u_layer;

in vec2 v_texCoord;

out vec4 fragColor;

void main() {
	vec4 tex = texture(u_image, vec3(v_texCoord.x, v_texCoord.y, u_layer));
 	fragColor = vec4(tex.rgb, tex.a);
}

`

// texture-arrays only exist on webgl2, so we can assume that we can
// use all the new features
class ProjectionTextureArrayRenderer extends ProjectionRenderer implements LayerRenderer {
	protected gl: WebGL2RenderingContext

	// uniform info
	protected u_layerInfo: WebGLUniformLocation

	constructor(layer: XRProjectionLayer, context: WebGL2RenderingContext) {
		super(layer, context)

		// recreate program to use texArray shaders
		this.program = createProgram(this.gl, texArrayVertexShader, texArrayFragmentShader)
		this._createVAOs()

		// uniform
		this.u_layerInfo = this.gl.getUniformLocation(this.program, 'u_layer')
	}

	public render(session: XRSessionWithLayer) {
		let gl = this.gl

		let textureType = this.layer.getTextureType()
		if (textureType === XRTextureType.texture) {
			throw new Error('Using texture array projection renderer on a layer without texture array.')
		}

		let baseLayer = session.getBaseLayer()

		// get texture type of layer
		gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.layer.colorTextures[0])
		gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR)

		for (let view of session.internalViews) {
			let index = session.getViewIndex(view)
			let viewport = baseLayer.getViewport(view)
			gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height)

			this._renderInternal(index)
		}
		gl.bindTexture(gl.TEXTURE_2D_ARRAY, null)
	}

	_renderInternal(layer: number = 0) {
		let gl = this.gl
		gl.useProgram(this.program)
		gl.bindVertexArray(this.vao)

		gl.uniform1i(this.u_layerInfo, layer)

		// Draw the rectangle.
		var primitiveType = gl.TRIANGLES
		var offset = 0
		var count = 6
		gl.drawArrays(primitiveType, offset, count)
		gl.bindVertexArray(null)
	}
}

export const createProjectionRenderer = (
	layer: XRProjectionLayer,
	context: XRWebGLRenderingContext
) => {
	if (layer.getTextureType() === XRTextureType['texture-array']) {
		if (context instanceof WebGL2RenderingContext) {
			return new ProjectionTextureArrayRenderer(layer, context)
		}
	}

	return new ProjectionRenderer(layer, context)
}
