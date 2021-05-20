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

import { mat4 } from 'gl-matrix'
import type { XRFrame, XRView, XRViewport } from 'webxr'
import XRCylinderLayer from '../api/XRCylinderLayer'
import XREquirectLayer from '../api/XREquirectLayer'
import XRQuadLayer from '../api/XRQuadLayer'
import { XRSessionWithLayer } from '../api/XRSessionWithLayer'
import {
	PolyfillTexture,
	XRLayerLayout,
	XRTextureType,
	XRViewportPolyfill,
	XRWebGLRenderingContext,
} from '../types'
import { initializeViewport } from '../utils/initialize-viewport'
import { applyVAOExtension, createProgram, VAOFunctions } from './webgl-utils'

// template tagging for syntax highlight
const glsl = (x) => x

const vertexShader = glsl`
attribute vec4 a_position;
attribute vec2 a_texCoord;

uniform mat4 u_matrix;
uniform mat4 u_projectionMatrix;

varying vec2 v_texCoord;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_projectionMatrix * u_matrix * a_position;

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
	// gl_FragColor = vec4(1.0, 0, 0, 1.0);
}
`

// shaders used for WebGL 2 texture-array case only
const texArrayVertexShader = glsl`#version 300 es

in vec4 a_position;
in vec2 a_texCoord;

uniform mat4 u_matrix;
uniform mat4 u_projectionMatrix;

out vec2 v_texCoord;

void main() {
	// Multiply the position by the matrix.
    gl_Position = u_projectionMatrix * u_matrix * a_position;
 
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

export type CompositionLayerRendererProgramInfo = {
	attribLocations: {
		a_position: number
		a_texCoord: number
	}
	uniformLocations: {
		u_matrix: WebGLUniformLocation
		u_projectionMatrix: WebGLUniformLocation
		u_layer?: WebGLUniformLocation
	}
}

export interface LayerRenderer {
	render(session: XRSessionWithLayer, frame?: XRFrame)
}

type FlatLayer = XRQuadLayer | XRCylinderLayer | XREquirectLayer

// used for everything except Projection and Cube layers
export class CompositionLayerRenderer {
	protected programInfo: CompositionLayerRendererProgramInfo

	protected texcoordBuffer: WebGLBuffer
	protected program: WebGLProgram

	protected gl: XRWebGLRenderingContext
	protected transformMatrix: mat4

	private positionPoints: Float32Array
	private texturePoints: Float32Array

	// used for stereo textures
	private stereoTexturePoints: Float32Array[]

	protected layer: FlatLayer

	protected vaoGl: VAOFunctions
	protected vao: WebGLVertexArrayObject | WebGLVertexArrayObjectOES

	protected usesTextureArrayShaders: boolean = false

	// custom texture for media layers
	protected mediaTexturePolyfill: PolyfillTexture
	protected mediaTexture: WebGLTexture

	constructor(layer: FlatLayer, context: XRWebGLRenderingContext) {
		this.gl = context
		this.layer = layer

		let gl = this.gl
		this.transformMatrix = mat4.create()

		// if we are WebGL 2 and texture type is texture-array, we are using
		// the texture array GLES 3.0 shaders
		if (
			context instanceof WebGL2RenderingContext &&
			this.layer.getTextureType() === XRTextureType['texture-array']
		) {
			this.usesTextureArrayShaders = true
		}

		// create the program
		if (this.usesTextureArrayShaders) {
			this.program = createProgram(gl, texArrayVertexShader, texArrayFragmentShader)
		} else {
			this.program = createProgram(gl, vertexShader, fragmentShader)
		}

		// create program info
		this.programInfo = {
			attribLocations: {
				a_position: gl.getAttribLocation(this.program, 'a_position'),
				a_texCoord: gl.getAttribLocation(this.program, 'a_texCoord'),
			},
			uniformLocations: {
				u_matrix: gl.getUniformLocation(this.program, 'u_matrix'),
				u_projectionMatrix: gl.getUniformLocation(this.program, 'u_projectionMatrix'),
			},
		}
		if (this.usesTextureArrayShaders) {
			this.programInfo.uniformLocations.u_layer = gl.getUniformLocation(this.program, 'u_layer')
		}
	}

	/**
	 * Initializes the renderer. This should be run in the constructor of derived renderers.
	 * The reason why it isn't just in the constructor of the base renderer is because creating
	 * geometry may require additional computation in the derived class, which would run after a
	 * super() call.
	 */
	initialize() {
		let gl = this.gl

		// create media textures if needed
		if (this.layer.isMediaLayer()) {
			this.mediaTexture = gl.createTexture()
			this.mediaTexturePolyfill = {
				texture: this.mediaTexture,
				textureFormat: gl.RGBA,
				width: this.layer.media.videoWidth,
				height: this.layer.media.videoHeight,
				type: XRTextureType.texture,
			}

			const existingTextureBinding = gl.getParameter(gl.TEXTURE_BINDING_2D)
			gl.bindTexture(gl.TEXTURE_2D, this.mediaTexture)
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				this.layer.media.videoWidth,
				this.layer.media.videoHeight,
				0,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				null
			)
			gl.bindTexture(gl.TEXTURE_2D, existingTextureBinding)
		}

		// setup geometry and VAO
		this._createVAOs()
	}

	render(session: XRSessionWithLayer, frame: XRFrame) {
		let gl = this.gl
		// set viewport
		// we already rendered the views into the layer's color textures
		// so we can just render them all into the baselayer
		let baseLayer = session.getBaseLayer()
		let basePose = frame.getViewerPose(session.getReferenceSpace())

		for (let view of basePose.views) {
			let viewport = baseLayer.getViewport(view)
			gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height)
			gl.activeTexture(gl.TEXTURE0)

			if (this.usesTextureArrayShaders) {
				if (gl instanceof WebGLRenderingContext) {
					throw new Error('This should never happen; texture-arrays only supported on WebGL2.')
				}
				if (this.layer.isMediaLayer()) {
					throw new Error(
						'This should never happen. Media layers should never be created with texture-array'
					)
				}

				// if we're using texture-array, there is always only a single entry in layer.colorTextures
				// and instead we use the layers uniform to render out individual pieces.
				const existingTextureBinding = gl.getParameter(gl.TEXTURE_BINDING_2D_ARRAY)

				gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.layer.colorTextures[0])
				gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
				gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR)

				let layer: number = 0
				if (this.layer.layout === XRLayerLayout.stereo) {
					// STEREO CASE - we only have multiple layers if we have a stereo layer, in which case
					// the right eye should use layer 1.
					switch (view.eye) {
						case 'right':
							layer = 1
							break
					}
				}
				// for stereo-left-right and stereo-top-bottom, we need to update
				// the texture UVs to get the correct slice of texture
				if (this._shouldUseStereoTexturePoints()) {
					this._renderInternalStereo(session, frame, view, layer)
				} else {
					this._renderInternal(session, frame, view, layer)
				}
				gl.bindTexture(gl.TEXTURE_2D_ARRAY, existingTextureBinding)
			} else {
				const existingTextureBinding = gl.getParameter(gl.TEXTURE_BINDING_2D)

				if (this.layer.isMediaLayer()) {
					// we have to bind the media to gl instead!
					gl.bindTexture(gl.TEXTURE_2D, this.mediaTexture)
					gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
					gl.texSubImage2D(
						gl.TEXTURE_2D,
						0,
						0,
						0,
						this.layer.media.videoWidth,
						this.layer.media.videoHeight,
						gl.RGBA,
						gl.UNSIGNED_BYTE,
						this.layer.media as any
					)
				} else if (this.layer.layout === XRLayerLayout.stereo) {
					// STEREO CASE - we have to pull out the multiple textures from the texture array
					switch (view.eye) {
						case 'right':
							gl.bindTexture(gl.TEXTURE_2D, this.layer.colorTextures[1])
							break
						default:
							gl.bindTexture(gl.TEXTURE_2D, this.layer.colorTextures[0])
					}
				} else {
					// for mono and split-screen stereo, we only have the one texture
					gl.bindTexture(gl.TEXTURE_2D, this.layer.colorTextures[0])
				}

				// Set the parameters so we can render any size image.
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

				// for stereo-left-right and stereo-top-bottom, we need to update
				// the texture UVs to get the correct slice of texture
				if (this._shouldUseStereoTexturePoints()) {
					this._renderInternalStereo(session, frame, view)
				} else {
					this._renderInternal(session, frame, view)
				}
				gl.bindTexture(gl.TEXTURE_2D, existingTextureBinding)
			}
		}
	}

	// override this to set position values!
	createPositionPoints(): Float32Array {
		return new Float32Array([])
	}

	// override this to set texture coords!
	createTextureUVs(): Float32Array {
		return new Float32Array([])
	}

	// STEREO RENDERING FUNCTIONS
	////////////////////////////////

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

	// NOTE: this does not initialize any data!
	// TODO: this is probably more efficient as a separate shader.
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

	// INITIALIZATION
	// THESE FUNCTIONS ARE CALLED IN CONSTRUCTOR
	//////////////////////////////////////////////

	_recalculateVertices() {
		this.positionPoints = this.createPositionPoints()
		this.texturePoints = this.createTextureUVs()

		// calculate stereo layers if needed
		const viewport: XRViewportPolyfill = {
			x: 0,
			y: 0,
			width: 1,
			height: 1,
		}

		if (this._shouldUseStereoTexturePoints()) {
			this.stereoTexturePoints = []

			if (this.layer.isMediaLayer()) {
				initializeViewport(viewport, this.mediaTexturePolyfill, this.layer.layout, 0, 2)
				this.stereoTexturePoints[0] = this._offsetTextureUVsByRect(
					this.mediaTexturePolyfill,
					this.texturePoints,
					viewport
				)

				initializeViewport(viewport, this.mediaTexturePolyfill, this.layer.layout, 1, 2)
				this.stereoTexturePoints[1] = this._offsetTextureUVsByRect(
					this.mediaTexturePolyfill,
					this.texturePoints,
					viewport
				)

				return
			}

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

	_createVAOs() {
		this._recalculateVertices()
		let gl = this.gl

		// makes sure that VAOs are usable on both WebGL1 and WebGL2
		this.vaoGl = applyVAOExtension(gl)

		// position
		let positionBuffer = gl.createBuffer()
		this.vao = this.vaoGl.createVertexArray()

		this.vaoGl.bindVertexArray(this.vao)
		// Turn on the position attribute
		gl.enableVertexAttribArray(this.programInfo.attribLocations.a_position)

		// Bind the position buffer.
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)

		const positions = this.positionPoints
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

		// Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
		var size = 3 // 3 components per iteration
		var type = gl.FLOAT // the data is 32bit floats
		var normalize = false // don't normalize the data
		var stride = 0 // 0 = move forward size * sizeof(type) each iteration to get the next position
		var offset = 0 // start at the beginning of the buffer
		gl.vertexAttribPointer(
			this.programInfo.attribLocations.a_position,
			size,
			type,
			normalize,
			stride,
			offset
		)

		// textures
		gl.enableVertexAttribArray(this.programInfo.attribLocations.a_texCoord)

		this.texcoordBuffer = gl.createBuffer()

		// bind the texcoord buffer.
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoordBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, this.texturePoints, gl.STATIC_DRAW)

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

		this.vaoGl.bindVertexArray(null)
		gl.bindBuffer(gl.ARRAY_BUFFER, null)
	}

	// RENDERING
	/////////////////

	/**
	 * @param frame
	 * @param view
	 * @param layer only relevant for texture_arrays - used to determine which layer to render from.
	 */
	_renderInternal(session: XRSessionWithLayer, frame: XRFrame, view: XRView, layer?: number) {
		let gl = this.gl

		// Tell it to use our program (pair of shaders)
		gl.useProgram(this.program)
		this.vaoGl.bindVertexArray(this.vao)

		// LAYER
		if (this.usesTextureArrayShaders) {
			gl.uniform1i(this.programInfo.uniformLocations.u_layer, layer)
		}

		// MATRIX
		// set matrix
		this._setTransformMatrix(session, frame, view)
		gl.uniformMatrix4fv(this.programInfo.uniformLocations.u_matrix, false, this.transformMatrix)
		gl.uniformMatrix4fv(
			this.programInfo.uniformLocations.u_projectionMatrix,
			false,
			view.projectionMatrix
		)

		// Draw the shape
		var primitiveType = gl.TRIANGLES
		var offset = 0
		var count = this.positionPoints.length / 3
		gl.drawArrays(primitiveType, offset, count)

		this.vaoGl.bindVertexArray(null)
	}

	// this is used only for stereo-left-right and stereo-top-bottom layers, and is used to render
	// a part of a texture to a view.
	_renderInternalStereo(session: XRSessionWithLayer, frame: XRFrame, view: XRView, layer?: number) {
		if (view.eye === 'none') {
			return this._renderInternal(session, frame, view)
		}
		let gl = this.gl
		this.vaoGl.bindVertexArray(this.vao)

		// Tell it to use our program (pair of shaders)
		gl.useProgram(this.program)

		// set position array and texture array
		// we have to set the texture buffer data for every eye
		this._setStereoTextureBuffer(view.eye === 'right' ? 1 : 0)

		// LAYER
		if (this.usesTextureArrayShaders) {
			gl.uniform1i(this.programInfo.uniformLocations.u_layer, layer)
		}

		// MATRIX
		// set matrix
		this._setTransformMatrix(session, frame, view)
		// we want the inverse, taken from the explainer:
		// https://immersive-web.github.io/webxr/explainer.html#viewer-tracking-with-webgl
		gl.uniformMatrix4fv(this.programInfo.uniformLocations.u_matrix, false, this.transformMatrix)
		gl.uniformMatrix4fv(
			this.programInfo.uniformLocations.u_projectionMatrix,
			false,
			view.projectionMatrix
		)

		// Draw the shape
		var primitiveType = gl.TRIANGLES
		var offset = 0
		var count = this.positionPoints.length / 3
		gl.drawArrays(primitiveType, offset, count)

		this.vaoGl.bindVertexArray(null)
	}

	_setTransformMatrix(session: XRSessionWithLayer, frame: XRFrame, view: XRView) {
		let objPose = frame.getPose(this.layer.space, session.getReferenceSpace())
		mat4.multiply(this.transformMatrix, objPose.transform.matrix, this.layer.transform.matrix)

		// see https://developer.mozilla.org/en-US/docs/Web/API/XRView/transform#examples for why we do this.
		mat4.multiply(this.transformMatrix, view.transform.inverse.matrix, this.transformMatrix)
	}
}
