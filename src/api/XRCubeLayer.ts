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

import type { XRSpace } from 'webxr'
import {
	PolyfillTexture,
	XRCubeLayerInit,
	XRLayerLayout,
	XRSessionPolyfill,
	XRTextureType,
	XRWebGLRenderingContext,
} from '../types'
import { isReferenceSpace } from '../utils/is-reference-space'
import XRCompositionLayerPolyfill from './XRCompositionLayerPolyfill'

export const defaultCubeLayerInit: XRCubeLayerInit = {
	colorFormat: 0x1908,
	mipLevels: 1,
	layout: XRLayerLayout.mono,
	isStatic: false,
	space: null, // this is required
	viewPixelHeight: 0, // this is required
	viewPixelWidth: 0, // this is required
}

export default class XRCubeLayer extends XRCompositionLayerPolyfill {
	public space: XRSpace
	public orientation: DOMPointReadOnly

	protected init: XRCubeLayerInit

	constructor(init: XRCubeLayerInit = defaultCubeLayerInit) {
		super()

		if (!isReferenceSpace(init.space)) {
			throw new TypeError("XRCubeLayer's space needs to be an XRReferenceSpace")
		}

		// UNIMPLEMENTED: if init.space has a type of "viewer", throw TypeError and abort these steps
		this.init = { ...defaultCubeLayerInit, ...init }
		this.space = this.init.space

		this.isStatic = this.init.isStatic
		if (this.init.orientation) {
			this.orientation = DOMPointReadOnly.fromPoint(this.init.orientation)
		} else {
			this.orientation = new DOMPointReadOnly()
		}

		switch (this.init.layout) {
			case XRLayerLayout.default:
			case XRLayerLayout['stereo-left-right']:
			case XRLayerLayout['stereo-top-bottom']:
				throw new TypeError('Invalid layout format for XRCubeLayer')
		}

		this.layout = this.init.layout
		this.needsRedraw = true
	}

	initialize(session: XRSessionPolyfill, context?: XRWebGLRenderingContext) {
		super.initialize(session, context)

		this._allocateColorTexturesInternal()
		this._allocateDepthStencilTexturesInternal()
	}

	protected _allocateColorTexturesInternal() {
		this._colorTextures = []
		this._texturesMeta = []
		if (this.layout === XRLayerLayout.mono) {
			const colorTexture = this._createCubeColorTexture()
			this._texturesMeta.push(colorTexture)
			this._colorTextures.push(colorTexture.texture)
			return
		} else {
			const texture1 = this._createCubeColorTexture()
			const texture2 = this._createCubeColorTexture()

			this._texturesMeta.push(texture1, texture2)
			this._colorTextures.push(texture1.texture, texture2.texture)
			return
		}
	}

	protected _allocateDepthStencilTexturesInternal() {
		this._depthStencilTextures = []

		if (!this.init.depthFormat) {
			return
		}

		// If context is a WebGLRenderingContext and the WEBGL_depth_texture extension
		// is not enabled in context, throw TypeError
		if (this.context instanceof WebGLRenderingContext) {
			let depthExtension = this.context.getExtension('WEBGL_depth_texture')
			if (!depthExtension) {
				throw new TypeError('Depth textures not supported in the current context')
			}
		}

		if (this.layout === XRLayerLayout.mono) {
			const depthTexture = this._createCubeDepthTexture()
			this._depthStencilTextures.push(depthTexture.texture)
			return
		} else {
			const texture1 = this._createCubeDepthTexture()
			const texture2 = this._createCubeDepthTexture()

			this._depthStencilTextures.push(texture1.texture, texture2.texture)
			return
		}
	}

	_createCubeColorTexture() {
		let texture = this.context.createTexture()
		let textureMeta: PolyfillTexture = {
			width: this.init.viewPixelWidth,
			height: this.init.viewPixelHeight,
			layers: 1,
			type: XRTextureType.texture,
			textureFormat: this.init.colorFormat,
			texture,
		}

		this.context.bindTexture(this.context.TEXTURE_CUBE_MAP, texture)

		// initialize size for all the sides of the cubemap
		for (let i = 0; i < 6; i++) {
			this.context.texImage2D(
				this.context.TEXTURE_CUBE_MAP_POSITIVE_X + i,
				0,
				textureMeta.textureFormat,
				textureMeta.width,
				textureMeta.height,
				0,
				textureMeta.textureFormat,
				this.context.UNSIGNED_BYTE,
				null
			)
		}

		return textureMeta
	}

	_createCubeDepthTexture() {
		let texture = this.context.createTexture()
		let textureMeta: PolyfillTexture = {
			width: this.init.viewPixelWidth,
			height: this.init.viewPixelHeight,
			layers: 1,
			type: XRTextureType.texture,
			textureFormat: this.init.depthFormat,
			texture,
		}

		this.context.bindTexture(this.context.TEXTURE_CUBE_MAP, texture)

		// DEPTH_COMPONENT is not a valid internalFormat in WebGL2.
		// https://stackoverflow.com/a/60703526
		let internalFormat = this.init.depthFormat
		if (this.context instanceof WebGL2RenderingContext) {
			if (internalFormat === this.context.DEPTH_COMPONENT) {
				internalFormat = this.context.DEPTH_COMPONENT24
			}
		}

		// initialize size for all the sides of the cubemap
		for (let i = 0; i < 6; i++) {
			this.context.texImage2D(
				this.context.TEXTURE_CUBE_MAP_POSITIVE_X + i,
				0,
				internalFormat,
				textureMeta.width,
				textureMeta.height,
				0,
				textureMeta.textureFormat,
				this.context.UNSIGNED_INT,
				null
			)
		}

		return textureMeta
	}

	public getTextureType(): XRTextureType {
		return XRTextureType.texture
	}
}
