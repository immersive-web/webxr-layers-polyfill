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
	XRCompositionLayer,
	XRLayerInit,
	XRLayerLayout,
	XRSessionPolyfill,
	XRTextureType,
	XRWebGLRenderingContext,
} from '../types'

export default class XRCompositionLayerPolyfill implements XRCompositionLayer {
	public layout: XRLayerLayout

	public blendTextureSourceAlpha: boolean
	public chromaticAberrationCorrection: boolean

	public mipLevels: number
	public needsRedraw: boolean

	// if isStatic is true the author can only draw into the layer once after creation or once after a redraw event. This allows the UA to only allocate a single GPU buffer.
	public isStatic: boolean

	public session: XRSessionPolyfill
	public context: XRWebGLRenderingContext

	protected _colorTextures: WebGLTexture[]
	// would be opaque texture in non-polyfill
	protected _depthStencilTextures: WebGLTexture[]

	// meta for textures are mainly to store width and height
	protected _texturesMeta: PolyfillTexture[]

	private _hasRunDeferredInitialize: boolean = false

	protected _media: HTMLVideoElement = null

	initialize(session: XRSessionPolyfill, context?: XRWebGLRenderingContext) {
		this.session = session
		if (context) {
			this.context = context
		}

		this.blendTextureSourceAlpha = true

		// if user agent supports chromatic abberation correction,
		// we should honor user agent. But the polyfill can't do that.
		this.chromaticAberrationCorrection = false
	}

	destroy() {
		this._colorTextures = []
		this._depthStencilTextures = []

		// destroy underlying GL attachments
	}

	// EventTarget things. Figure this out from the WebXR polyfill!
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions
	): void {}
	/**
	 * Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.
	 */
	dispatchEvent(event: Event): boolean {
		return false
	}
	/**
	 * Removes the event listener in target's event listener list with the same type, callback, and options.
	 */
	removeEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: EventListenerOptions | boolean
	): void {}

	public getContext(): XRWebGLRenderingContext {
		return this.context
	}

	public getTextureType(): XRTextureType {
		// override this please
		throw new Error('Unimplemented')
	}

	get colorTextures() {
		return this._colorTextures
	}

	get depthStencilTextures() {
		return this._depthStencilTextures
	}

	// POLYFILL ONLY: Get metadata for textures
	get colorTexturesMeta() {
		return this._texturesMeta
	}

	// POLYFILL ONLY: Get media source for media layers
	get media(): HTMLVideoElement {
		if (!this.isMediaLayer()) {
			console.warn('Attempted to retrieve media from a non-media layer')
		}
		return this._media
	}

	protected determineLayoutAttribute(
		textureType: XRTextureType,
		context: XRWebGLRenderingContext,
		layout: XRLayerLayout
	): XRLayerLayout {
		if (
			!(context instanceof WebGL2RenderingContext) &&
			textureType === XRTextureType['texture-array']
		) {
			throw new TypeError()
		}

		// UNIMPLEMENTED: If textureType is "texture-array" and not all of the session’s views in the list of views have the same recommended WebGL texture resolution,
		// throw a NotSupportedError and abort these steps.

		if (layout === XRLayerLayout.mono) {
			return layout
		}

		if (layout === XRLayerLayout.default) {
			// If the size of list of views is 1, return "mono" and abort these steps.
			if (this.session.internalViews && this.session.internalViews.length === 1) {
				return XRLayerLayout['mono']
			}

			if (textureType === XRTextureType['texture-array']) {
				return layout
			}
		}

		if (layout === XRLayerLayout.default || layout === XRLayerLayout.stereo) {
			// If the user agent prefers "stereo-left-right" layout, return "stereo-left-right" and abort these steps.
			return XRLayerLayout['stereo-left-right']

			// If the user agent prefers "stereo-top-bottom" layout, return "stereo-top-bottom" and abort these steps.
		}

		return layout
	}

	// projection and cube layers are never media layers
	public isMediaLayer(): boolean {
		return this._media !== null
	}

	// LAZY INITIALIZATION
	////////////////////////

	// override this to initialize things, assuming that session.views already exists
	protected _deferredInitialize() {}

	// Call this to run deferred initialize
	// do not override it
	protected initializeIfNeeded() {
		// OVERRIDE THIS
		if (!this._hasRunDeferredInitialize) {
			this._hasRunDeferredInitialize = true
			this._deferredInitialize()
		}
	}

	// ALLOCATING TEXTURES
	// NOTE: Projection layers override this behavior
	///////////////////////////////////////////////////

	// https://www.w3.org/TR/webxrlayers-1/#allocate-color-textures
	protected _allocateColorTexturesInternal(textureType: XRTextureType, init: XRLayerInit): void {
		let session = this.session
		let views = session.internalViews

		if (!views || views.length === 0) {
			// can't allocate if there are no views
			console.warn("We can't allocate color textures without views")
			return
		}

		// TODO UNIMPLEMENTED: If init’s mipLevels is smaller than 1, throw a InvalidStateError and abort these steps.

		// TODO UNIMPLEMENTED: If init’s mipLevels is larger than 1 and viewPixelWidth and viewPixelHeight are not powers of 2,
		// throw a InvalidStateError and abort these steps

		// POLYFILL ONLY: initialize layout if we haven't already
		this.initializeIfNeeded()

		// UNIMPLEMENTED: If init’s colorFormat is not in the list of color formats
		// for non-projection layers, throw a NotSupportedError and abort these steps.

		if (this.layout === XRLayerLayout.mono) {
			if (textureType === XRTextureType['texture-array']) {
				// Initialize array with 1 new instance of an opaque texture in the relevant realm of this context created
				// as a TEXTURE_2D_ARRAY texture with 1 internal texture using context and init’s colorFormat, mipLevels, viewPixelWidth and viewPixelHeight values.
				const newTexture = this._createNewColorTexture(
					init.viewPixelWidth,
					init.viewPixelHeight,
					textureType,
					init.colorFormat
				)

				this._texturesMeta = [newTexture]
				this._colorTextures = [newTexture.texture]
				return
			} else {
				// Initialize array with 1 new instance of an opaque texture in the relevant realm of context created as a
				// TEXTURE_2D texture with context and
				// init’s colorFormat, mipLevels, viewPixelWidth and viewPixelHeight values.

				const newTexture = this._createNewColorTexture(
					init.viewPixelWidth,
					init.viewPixelHeight,
					textureType,
					init.colorFormat
				)

				this._texturesMeta = [newTexture]
				this._colorTextures = [newTexture.texture]
				return
			}
		} else if (this.layout === XRLayerLayout.stereo) {
			if (textureType === XRTextureType['texture-array']) {
				// Initialize array with 1 new instance of an opaque texture in the relevant realm of context created as a
				// TEXTURE_2D_ARRAY texture with 2 layers using context and init’s colorFormat, mipLevels, viewPixelWidth and viewPixelHeight values.
				// TODO: use a new createNewColorTextureArray function for this!
				// See https://github.com/WebGLSamples/WebGL2Samples/blob/master/samples/texture_2d_array.html#L145-L160
				const newTexture = this._createNewColorTexture(
					init.viewPixelWidth,
					init.viewPixelHeight,
					textureType,
					init.colorFormat,
					2
				)

				this._texturesMeta = [newTexture]
				this._colorTextures = [newTexture.texture]
				return
			} else {
				const texture1 = this._createNewColorTexture(
					init.viewPixelWidth,
					init.viewPixelHeight,
					textureType,
					init.colorFormat
				)
				const texture2 = this._createNewColorTexture(
					init.viewPixelWidth,
					init.viewPixelHeight,
					textureType,
					init.colorFormat
				)

				this._texturesMeta = [texture1, texture2]
				this._colorTextures = [texture1.texture, texture2.texture]
				return
			}
		} else if (this.layout === XRLayerLayout['stereo-left-right']) {
			const newTexture = this._createNewColorTexture(
				init.viewPixelWidth * 2,
				init.viewPixelHeight,
				textureType,
				init.colorFormat
			)

			this._texturesMeta = [newTexture]
			this._colorTextures = [newTexture.texture]
			return
		} else if (this.layout === XRLayerLayout['stereo-top-bottom']) {
			const newTexture = this._createNewColorTexture(
				init.viewPixelWidth,
				init.viewPixelHeight * 2,
				textureType,
				init.colorFormat
			)

			this._texturesMeta = [newTexture]
			this._colorTextures = [newTexture.texture]
			return
		}
	}

	protected _allocateDepthStencilTexturesInternal(
		textureType: XRTextureType,
		init: XRLayerInit
	): void {
		if (!init.depthFormat) {
			this._depthStencilTextures = []
			return
		}

		if (this._getSupportedDepthFormats().indexOf(init.depthFormat) < 0) {
			throw new Error('Depth format provided is not supported in non-projection layers.')
		}

		if (init.mipLevels < 1) {
			throw new Error('Invalid miplevel. Miplevel needs to be >= 1')
		}

		// UNIMPLEMENTED: If init’s mipLevels is larger than 1 and
		// viewPixelWidth and viewPixelHeight are not powers of 2,
		// throw a InvalidStateError and abort these steps.

		if (this.layout === XRLayerLayout.mono) {
			if (textureType === XRTextureType['texture-array']) {
				const newTexture = this._createNewDepthStencilTexture(
					init.viewPixelWidth,
					init.viewPixelHeight,
					textureType,
					init.depthFormat
				)

				this._depthStencilTextures = [newTexture.texture]
				return
			} else {
				const newTexture = this._createNewColorTexture(
					init.viewPixelWidth,
					init.viewPixelHeight,
					textureType,
					init.depthFormat
				)

				this._depthStencilTextures = [newTexture.texture]
				return
			}
		} else if (this.layout === XRLayerLayout.stereo) {
			if (textureType === XRTextureType['texture-array']) {
				const newTexture = this._createNewDepthStencilTexture(
					init.viewPixelWidth,
					init.viewPixelHeight,
					textureType,
					init.depthFormat,
					2
				)

				this._depthStencilTextures = [newTexture.texture]
				return
			} else {
				const texture1 = this._createNewDepthStencilTexture(
					init.viewPixelWidth,
					init.viewPixelHeight,
					textureType,
					init.depthFormat
				)
				const texture2 = this._createNewDepthStencilTexture(
					init.viewPixelWidth,
					init.viewPixelHeight,
					textureType,
					init.depthFormat
				)

				this._depthStencilTextures = [texture1.texture, texture2.texture]
				return
			}
		} else if (this.layout === XRLayerLayout['stereo-left-right']) {
			const newTexture = this._createNewDepthStencilTexture(
				init.viewPixelWidth * 2,
				init.viewPixelHeight,
				textureType,
				init.depthFormat
			)

			this._depthStencilTextures = [newTexture.texture]
			return
		} else if (this.layout === XRLayerLayout['stereo-top-bottom']) {
			const newTexture = this._createNewDepthStencilTexture(
				init.viewPixelWidth,
				init.viewPixelHeight * 2,
				textureType,
				init.depthFormat
			)

			this._depthStencilTextures = [newTexture.texture]
			return
		}
	}

	protected _createNewColorTexture(
		width: number,
		height: number,
		textureType: XRTextureType,
		colorFormat: GLenum,
		layers: number = 1
	): PolyfillTexture {
		return this._createGenericPolyfillTexture(textureType, width, height, colorFormat, 0, layers)
	}

	protected _createNewDepthStencilTexture(
		width,
		height,
		textureType: XRTextureType,
		depthFormat: GLenum,
		layers: number = 1
	): PolyfillTexture {
		// If we have layers and are a texture-array, do that instead.
		return this._createGenericPolyfillTexture(textureType, width, height, depthFormat, 0, layers)
	}

	private _createGenericPolyfillTexture(
		textureType: XRTextureType,
		width: number,
		height: number,
		textureFormat: GLenum,
		mipmapLevel: number = 0,
		numLayers: number = 1
	): PolyfillTexture {
		// CHECKS FOR CORRECTNESS
		if (textureType === XRTextureType['texture-array'] && numLayers <= 1) {
			console.warn('creating a texture array with a single layer...')
		}
		if (
			textureType === XRTextureType['texture-array'] &&
			this.context instanceof WebGLRenderingContext
		) {
			throw new Error('WebGL 1 does not support texture array')
		}

		// CREATE THE TEXTURE AND SURROUNDING METADATA
		let texture = this.context.createTexture()
		let textureMeta: PolyfillTexture = {
			width,
			height,
			layers: numLayers,
			type: textureType,
			textureFormat: textureFormat,
			texture,
		}

		// DEPTH_COMPONENT is not a valid internalFormat in WebGL2.
		// https://stackoverflow.com/a/60703526
		let internalFormat = textureFormat
		if (this.context instanceof WebGL2RenderingContext) {
			if (internalFormat === this.context.DEPTH_COMPONENT) {
				internalFormat = this.context.DEPTH_COMPONENT24
			}
			if (internalFormat === this.context.DEPTH_STENCIL) {
				internalFormat = this.context.DEPTH24_STENCIL8
			}
			// SRGB and SRGB8_ALPHA8 not valid component for texture format
			// https://www.khronos.org/registry/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE
			if (internalFormat === this.context.SRGB) {
				textureFormat = this.context.RGB
			}
			if (internalFormat === this.context.SRGB8_ALPHA8) {
				textureFormat = this.context.RGBA
			}
		}

		// calculate the texture's image type
		// For depth components, UNSIGNED_BYTE is not a valid image type
		// we need to use UNSIGNED_INT instead.
		let texImageType = this.context.UNSIGNED_BYTE
		if (textureFormat === this.context.DEPTH_COMPONENT) {
			texImageType = this.context.UNSIGNED_INT
		}

		if (this.context instanceof WebGL2RenderingContext) {
			if (textureFormat === this.context.DEPTH_COMPONENT24) {
				texImageType = this.context.UNSIGNED_INT
			}
			if (
				textureFormat === this.context.DEPTH24_STENCIL8 ||
				textureFormat === this.context.DEPTH_STENCIL
			) {
				texImageType = this.context.UNSIGNED_INT_24_8
			}
		} else {
			// WebGL1 specific code
			if (textureFormat === this.context.DEPTH_STENCIL) {
				// this only exists if we have the WEBGL_depth_texture extension, but
				// we assume that we must have it in order to get this far.
				texImageType = (this.context as any).UNSIGNED_INT_24_8_WEBGL
			}
		}

		if (
			textureType === XRTextureType['texture-array'] &&
			this.context instanceof WebGL2RenderingContext
		) {
			console.warn(
				'texture-array layers are supported...questionably in the polyfill at the moment. Use at your own risk.'
			)
			// create a 2d texture array
			const existingTextureBinding = this.context.getParameter(
				this.context.TEXTURE_BINDING_2D_ARRAY
			)
			this.context.bindTexture(this.context.TEXTURE_2D_ARRAY, texture)
			if (this._getSupportedDepthFormats().indexOf(textureFormat) >= 0) {
				this.context.texStorage3D(
					this.context.TEXTURE_2D_ARRAY,
					1,
					internalFormat,
					width,
					height,
					numLayers
				)
			} else {
				this.context.texImage3D(
					this.context.TEXTURE_2D_ARRAY,
					0,
					internalFormat,
					width,
					height,
					numLayers,
					0,
					textureFormat,
					texImageType,
					null
				)
			}
			this.context.bindTexture(this.context.TEXTURE_2D_ARRAY, existingTextureBinding)
		} else {
			// regular texture 2d
			const existingTextureBinding = this.context.getParameter(this.context.TEXTURE_BINDING_2D)
			this.context.bindTexture(this.context.TEXTURE_2D, texture)
			this.context.texImage2D(
				this.context.TEXTURE_2D,
				0,
				internalFormat,
				width,
				height,
				0,
				textureFormat,
				texImageType,
				null
			)
			this.context.bindTexture(this.context.TEXTURE_2D, existingTextureBinding)
		}
		return textureMeta
	}

	private _getSupportedDepthFormats(): GLenum[] {
		const supportedDepthFormats = []

		if (this.context instanceof WebGLRenderingContext) {
			if (!this.context.getExtension('WEBGL_depth_texture')) {
				return supportedDepthFormats
			}
		}

		supportedDepthFormats.push(this.context.DEPTH_COMPONENT, this.context.DEPTH_STENCIL)

		if (this.context instanceof WebGL2RenderingContext) {
			supportedDepthFormats.push(this.context.DEPTH_COMPONENT24, this.context.DEPTH24_STENCIL8)
		}

		return supportedDepthFormats
	}
}
