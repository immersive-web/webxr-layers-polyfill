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

import {
	PolyfillTexture,
	XRLayerLayout,
	XRSessionPolyfill,
	XRProjectionLayerInit,
	XRTextureType,
	XRWebGLRenderingContext
} from '../types'
import XRCompositionLayerPolyfill from './XRCompositionLayerPolyfill'

export const defaultXRProjectionLayerInit: XRProjectionLayerInit = {
	textureType: XRTextureType.texture,
	colorFormat: 0x1908,
	depthFormat: 0x1902,
	scaleFactor: 1.0,
}

export default class XRProjectionLayer extends XRCompositionLayerPolyfill {
	public textureWidth: number
	public textureHeight: number
	public textureArrayLength: number

	public ignoreDepthValues: boolean
	public fixedFoveation: number

	protected init: XRProjectionLayerInit

	// HACK: store the width / heights of the color textures here so we can pull them out later
	private _colorTexturesMeta: PolyfillTexture[]

	constructor(init: XRProjectionLayerInit = defaultXRProjectionLayerInit) {
		super()
		this.init = { ...defaultXRProjectionLayerInit, ...init }
	}

	initialize(session: XRSessionPolyfill, context?: XRWebGLRenderingContext) {
		super.initialize(session, context)

		// POLYFILL ONLY: initialize layout
		this.initializeIfNeeded()

		let baseLayer = session.getBaseLayer()

		this.textureWidth = baseLayer.framebufferWidth * this.init.scaleFactor
		this.textureHeight = baseLayer.framebufferHeight * this.init.scaleFactor
	}

	protected _allocateProjectionColorTextures(): void {
		let array: WebGLTexture[] = []
		let polyFillArray: PolyfillTexture[] = []

		const createTextureArray = () => {
			array = []
			for (let tex of polyFillArray) {
				array.push(tex.texture)
			}
		}

		let session = this.session
		let views = session.internalViews

		if (!views || views.length === 0) {
			// can't allocate if there are no views
			console.warn("We can't allocate color textures without views")
			return
		}

		let baseLayer = session.getBaseLayer()
		let numViews = views.length

		let width = baseLayer.framebufferWidth * this.init.scaleFactor / views.length
		let height = baseLayer.framebufferHeight * this.init.scaleFactor

		if (this.layout === XRLayerLayout.mono || this.layout === XRLayerLayout.default) {
			if (this.init.textureType === XRTextureType['texture-array']) {
				// UNIMPLEMENTED: If the session’s views in the list of views don’t all have the same recommended WebGL texture resolution excluding the secondary views,
				// throw a NotSupportedError and abort these steps.

				// Initialize array with 1 new instance of an opaque texture in the relevant realm of context created as a TEXTURE_2D_ARRAY texture
				// with numViews layers using context, textureFormat, width and height.
				let texture = this._createNewColorTexture(
					width,
					height,
					XRTextureType['texture-array'],
					this.init.colorFormat,
					numViews
				)
				polyFillArray = [texture]
			} else {
				for (let view of views) {
					// let texture be a new instance of an opaque texture
					// in the relevant realm of context created as a TEXTURE_2D texture
					// with context, textureFormat, width and height
					let texture: PolyfillTexture = this._createNewColorTexture(
						width,
						height,
						XRTextureType.texture,
						this.init.colorFormat
					)

					polyFillArray.push(texture)
				}
			}
			createTextureArray()
			this._colorTexturesMeta = polyFillArray
			this._colorTextures = array
			return
		}

		if (this.layout === XRLayerLayout['stereo-left-right']) {
			let texture = this._createNewColorTexture(
				width * numViews,
				height,
				this.init.textureType,
				this.init.colorFormat
			)

			polyFillArray = [texture]
		} else if (this.layout === XRLayerLayout['stereo-top-bottom']) {
			let texture = this._createNewColorTexture(
				width,
				height * numViews,
				this.init.textureType,
				this.init.colorFormat
			)

			polyFillArray = [texture]
		}
		createTextureArray()
		this._colorTexturesMeta = polyFillArray
		this._colorTextures = array
		return
	}

	protected _allocateProjectionDepthStencilTextures(): void {
		let session = this.session
		let views = session.internalViews

		if (!views || views.length === 0) {
			// can't allocate if there are no views
			return
		}

		// if textureFormat is a 0 abort steps.
		if (this.init.depthFormat === 0) {
			this._depthStencilTextures = []
			return
		}

		// If context is a WebGLRenderingContext and the WEBGL_depth_texture extension
		// is not enabled in context, return array and abort these steps.
		if (this.context instanceof WebGLRenderingContext) {
			let depthExtension = this.context.getExtension('WEBGL_depth_texture')
			if (!depthExtension) {
				this._depthStencilTextures = []
				return
			}
		}

		// UNIMPLEMENTED: If textureFormat is not in the list of depth formats for projection layers,
		// throw a NotSupportedError and abort these steps.

		// INITIALIZE EVERYTHING

		let array: WebGLTexture[] = []
		let polyFillArray: PolyfillTexture[] = []

		const createTextureArray = () => {
			array = []
			for (let tex of polyFillArray) {
				array.push(tex.texture)
			}
		}

		// POLYFILL ONLY: initialize layout if we haven't already
		this.initializeIfNeeded()

		let baseLayer = session.getBaseLayer()
		let numViews = views.length

		let width = baseLayer.framebufferWidth * this.init.scaleFactor / views.length
		let height = baseLayer.framebufferHeight * this.init.scaleFactor

		if (this.layout === XRLayerLayout.mono || this.layout === XRLayerLayout.default) {
			if (this.init.textureType === XRTextureType['texture-array']) {
				// UNIMPLEMENTED: If the session’s views in the list of views don’t all have the same
				// recommended WebGL texture resolution excluding the secondary views,
				// throw a NotSupportedError and abort these steps.

				// Initialize array with 1 new instance of an opaque texture in the relevant realm of
				// context created as a TEXTURE_2D_ARRAY texture
				// with numViews layers using context, textureFormat, width and height.
				let texture: PolyfillTexture = this._createNewDepthStencilTexture(
					width,
					height,
					this.init.textureType,
					this.init.depthFormat,
					numViews
				)

				polyFillArray = [texture]
			} else {
				for (let view of views) {
					// let texture be a new instance of an opaque texture
					// in the relevant realm of context created as a TEXTURE_2D texture
					// with context, textureFormat, width and height
					let texture: PolyfillTexture = this._createNewDepthStencilTexture(
						width,
						height,
						this.init.textureType,
						this.init.depthFormat
					)

					polyFillArray.push(texture)
				}
			}
			createTextureArray()
			this._depthStencilTextures = array
			return
		}

		if (this.layout === XRLayerLayout['stereo-left-right']) {
			let texture: PolyfillTexture = this._createNewDepthStencilTexture(
				width * numViews,
				height,
				this.init.textureType,
				this.init.depthFormat
			)
			polyFillArray = [texture]
		} else if (this.layout === XRLayerLayout['stereo-top-bottom']) {
			let texture: PolyfillTexture = this._createNewDepthStencilTexture(
				width,
				height * numViews,
				this.init.textureType,
				this.init.depthFormat
			)
			polyFillArray = [texture]
		}
		createTextureArray()
		this._depthStencilTextures = array
		return
	}

	get colorTextures() {
		if (!this._colorTextures || !this._colorTextures.length) {
			this._allocateProjectionColorTextures()
		}

		return this._colorTextures
	}

	get depthStencilTextures() {
		if (this._depthStencilTextures === undefined) {
			this._allocateProjectionDepthStencilTextures()
		}
		return this._depthStencilTextures || []
	}

	get colorTexturesMeta() {
		if (!this._colorTextures || !this._colorTextures.length) {
			this._allocateProjectionColorTextures()
		}

		return this._colorTexturesMeta
	}

	public getTextureType(): XRTextureType {
		return this.init.textureType
	}

	protected _deferredInitialize() {
		// initialize layer.isStatic = false
		this.isStatic = false

		// Some browsers use the depth for reprojection
		this.ignoreDepthValues = false

		// layer's fixedFoveation should be 0
		this.fixedFoveation = 0

		// let layout be the result of determining the layout attribute with init’s textureType, context and "default".
		let layout = this.determineLayoutAttribute(
			this.init.textureType,
			this.context,
			XRLayerLayout.default
		)

		// initialize layer's layout to the created layout
		this.layout = layout

		this.needsRedraw = true

		// Let maximum scalefactor be the result of determining the maximum scalefactor with session, context and layout.
		let maxScaleFactor = this.determineMaximumScaleFactor()

		// If scaleFactor is larger than maximum scalefactor, set scaleFactor to maximum scalefactor.
		let scaleFactor = Math.min(this.init.scaleFactor, maxScaleFactor)
		this.init.scaleFactor = scaleFactor
	}

	private determineMaximumScaleFactor() {
		// Let largest width be the largest width of the recommended WebGL texture resolution from the session’s list of views excluding the secondary views.
		let baseLayer = this.session.getBaseLayer(this.context)

		let largestWidth = baseLayer.framebufferWidth
		let largestHeight = baseLayer.framebufferHeight

		if (this.layout === XRLayerLayout['stereo-left-right']) {
			largestWidth *= 2
		}
		if (this.layout === XRLayerLayout['stereo-top-bottom']) {
			largestHeight *= 2
		}

		let largestViewDimension = Math.max(largestWidth, largestHeight)
		let largestTextureDimension = this.context.getParameter(this.context.MAX_TEXTURE_SIZE)

		return largestTextureDimension / largestViewDimension
	}
}
