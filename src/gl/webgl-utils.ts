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

import { XRWebGLRenderingContext } from '../types'

const compileShader = (
	gl: WebGLRenderingContext | WebGL2RenderingContext,
	shaderSource: string,
	shaderType: GLenum
): WebGLShader => {
	// Create the shader object
	var shader = gl.createShader(shaderType)

	// Set the shader source code.
	gl.shaderSource(shader, shaderSource)

	// Compile the shader
	gl.compileShader(shader)

	// Check if it compiled
	var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
	if (!success) {
		// Something went wrong during compilation; get the error
		throw 'could not compile shader:' + gl.getShaderInfoLog(shader)
	}

	return shader
}

/**
 * Creates a program from 2 shaders.
 */
export const createProgram = (
	gl: WebGLRenderingContext | WebGL2RenderingContext,
	vertexShader: string,
	fragmentShader: string
): WebGLProgram => {
	// create a program.
	const program = gl.createProgram()

	const compiledVS: WebGLShader = compileShader(gl, vertexShader, gl.VERTEX_SHADER)
	const compiledFS: WebGLShader = compileShader(gl, fragmentShader, gl.FRAGMENT_SHADER)

	// attach the shaders.
	gl.attachShader(program, compiledVS)
	gl.attachShader(program, compiledFS)

	gl.deleteShader(compiledVS)
	gl.deleteShader(compiledFS)

	// link the program.
	gl.linkProgram(program)

	// Check if it linked.
	var success = gl.getProgramParameter(program, gl.LINK_STATUS)
	if (!success) {
		// something went wrong with the link
		throw 'program failed to link:' + gl.getProgramInfoLog(program)
	}

	return program
}

// USED FOR PROJECTION RENDERER
export const setRectangle = (
	gl: WebGLRenderingContext | WebGL2RenderingContext,
	x,
	y,
	width,
	height
) => {
	var x1 = x
	var x2 = x + width
	var y1 = y
	var y2 = y + height
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]),
		gl.DYNAMIC_DRAW
	)
}

export type VAOFunctions =
	| WebGL2RenderingContext
	| {
			bindVertexArray(arrayObject: WebGLVertexArrayObjectOES | null): void
			createVertexArray(): WebGLVertexArrayObjectOES | null
			deleteVertexArray(arrayObject: WebGLVertexArrayObjectOES | null): void
			isVertexArray(arrayObject: WebGLVertexArrayObjectOES | null): GLboolean
	  }

// VAO support
export const applyVAOExtension = (gl: XRWebGLRenderingContext): VAOFunctions => {
	if (gl instanceof WebGL2RenderingContext) {
		return gl
	}

	const ext = gl.getExtension('OES_vertex_array_object')
	if (!ext) {
		throw new Error('Cannot use VAOs.')
	}

	return {
		bindVertexArray: ext.bindVertexArrayOES.bind(ext),
		createVertexArray: ext.createVertexArrayOES.bind(ext),
		deleteVertexArray: ext.deleteVertexArrayOES.bind(ext),
		isVertexArray: ext.isVertexArrayOES.bind(ext),
	}
}
