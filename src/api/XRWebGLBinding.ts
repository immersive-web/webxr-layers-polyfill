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

import type { XRFrame, XREye, XRView } from 'webxr'
import {
	PolyfillTexture,
	XRCubeLayerInit,
	XRCylinderLayerInit,
	XREquirectLayerInit,
	XRLayerLayout,
	XRProjectionLayerInit,
	XRQuadLayerInit,
	XRSessionPolyfill,
	XRTextureType,
	XRWebGLRenderingContext,
	XRWebGLSubImage,
} from '../types'
import { initializeViewport } from '../utils/initialize-viewport'
import { isReferenceSpace } from '../utils/is-reference-space'
import XRCompositionLayerPolyfill from './XRCompositionLayerPolyfill'
import XRCubeLayer from './XRCubeLayer'
import XRCylinderLayer, { defaultCylinderLayerInit } from './XRCylinderLayer'
import XREquirectLayer, { defaultEquirectLayerInit } from './XREquirectLayer'
import XRProjectionLayer, { defaultXRProjectionLayerInit } from './XRProjectionLayer'
import XRQuadLayer, { defaultQuadLayerInit } from './XRQuadLayer'
import XRWebGLSubImagePolyfill from './XRWebGLSubImage'

export default class XRWebGLBindingPolyfill {
	protected session: XRSessionPolyfill
	protected context: XRWebGLRenderingContext

	private subImageCache: SubImageCache
	constructor(session: XRSessionPolyfill, context: XRWebGLRenderingContext) {
		this.session = session
		this.context = context

		this.subImageCache = new SubImageCache()
	}

	public createProjectionLayer(
		init: XRProjectionLayerInit = defaultXRProjectionLayerInit
	): XRProjectionLayer {
		const layer = new XRProjectionLayer(init)

		if ((this.session as any).ended) {
			throw new Error('Session has ended')
		}

		if (this.context.isContextLost()) {
			throw new Error('context is lost')
		}

		// initialize a composition layer on layer with session and context
		layer.initialize(this.session, this.context)

		// POLYFILL ONLY: all the initialization in between here happens on the XRProjectionLayer object, since some of the steps need to be deferred until
		// the views are available

		// UNIMPLEMENTED: Everything with secondary views. The polyfill ignores them.

		// UNIMPLEMENTED: Allocate and initialize resources compatible with session’s XR device, including GPU accessible memory buffers, as required to support the compositing of layer.

		// UNIMPLEMENTED: If layer’s resources were unable to be created for any reason, throw an OperationError and abort these steps.

		return layer
	}

	public createQuadLayer(init: XRQuadLayerInit = defaultQuadLayerInit): XRQuadLayer {
		if ((this.session as any).ended) {
			throw new Error('Session has ended')
		}

		if (this.context.isContextLost()) {
			throw new Error('context is lost')
		}

		if (init.layout === XRLayerLayout.default) {
			throw new TypeError('Trying to create a quad layer with default layout')
		}

		const layer = new XRQuadLayer(init)

		layer.initialize(this.session, this.context)

		// everything else is created in the layer's deferred initialize step.

		return layer
	}

	public createCylinderLayer(
		init: XRCylinderLayerInit = defaultCylinderLayerInit
	): XRCylinderLayer {
		if ((this.session as any).ended) {
			throw new Error('Session has ended')
		}

		if (this.context.isContextLost()) {
			throw new Error('context is lost')
		}

		if (init.layout === XRLayerLayout.default) {
			throw new TypeError('Cylinder Layer cannot have a default layout')
		}

		const layer = new XRCylinderLayer(init)

		layer.initialize(this.session, this.context)

		// everything else is created in the layer's deferred initialize step

		return layer
	}

	public createEquirectLayer(
		init: XREquirectLayerInit = defaultEquirectLayerInit
	): XREquirectLayer {
		if ((this.session as any).ended) {
			throw new Error('Session has ended')
		}

		if (this.context.isContextLost()) {
			throw new Error('context is lost')
		}

		if (init.layout === XRLayerLayout.default) {
			throw new TypeError('Equirect Layer cannot have a default layout')
		}

		if (!isReferenceSpace(init.space)) {
			throw new TypeError('Equirect layer requires an XRReferenceSpace')
		}

		// UNIMPLEMENTED: If init’s space has a type of "viewer", throw TypeError and abort these steps.

		let layer = new XREquirectLayer(init)

		layer.initialize(this.session, this.context)

		// everything else is created in the layer's deferred initialize step

		return layer
	}

	public createCubeLayer(init: XRCubeLayerInit): XRCubeLayer {
		if ((this.session as any).ended) {
			throw new Error('Session has ended')
		}

		if (this.context.isContextLost()) {
			throw new Error('context is lost')
		}
		if (!(this.context instanceof WebGL2RenderingContext)) {
			throw new Error('XRCubeLayer only work on WebGL2')
		}

		if (!isReferenceSpace(init.space)) {
			throw new TypeError('XRCubeLayer requires a space of type XRReferenceSpace')
		}

		// UNIMPLEMENTED: If init’s space has a type of "viewer", throw TypeError and abort these steps.
		let layer = new XRCubeLayer(init)

		// set up color and depth textures, which doesn't need to be asynchronous
		// this happens in layer.initialize
		layer.initialize(this.session, this.context)

		return layer
	}
	public getSubImage(
		layer: XRCompositionLayerPolyfill,
		frame: XRFrame,
		eye: XREye = 'none'
	): XRWebGLSubImage {
		if (layer.isStatic && (layer.needsRedraw === false)) {
			throw new Error('Invalid state for subimage creation')
		}
		// if getSubImage was called previously with same binding, layer, and eye, the
		// user agent may return the same subimage as returned by earlier call
		let existingSubImage = this.subImageCache.tryGetCachedSubImage(this.context, layer, eye)
		if (existingSubImage) {
			return existingSubImage
		}

		let subimage = new XRWebGLSubImagePolyfill()

		if (layer instanceof XRProjectionLayer) {
			throw new TypeError()
		}

		if (layer.layout === XRLayerLayout.default) {
			throw new TypeError()
		}

		if (!this.validateStateofSubImageCreation(layer, frame)) {
			throw new Error('Invalid state for subimage creation')
		}

		let index = 0

		if (layer.layout === XRLayerLayout.stereo) {
			if (eye === 'none') {
				throw new TypeError()
			}
			if (eye === 'right') {
				index = 1
			}
		}

		// UNIMPLEMENTED: If validate the state of the XRWebGLSubImage creation function with layer and frame is false,
		// throw an InvalidStateError and abort these steps.

		// if layer is created with textureType 'texture-array'
		if (layer.getTextureType() === XRTextureType['texture-array']) {
			subimage.imageIndex = index
		} else {
			subimage.imageIndex = 0
		}

		let _textureIndex = 0

		// initialize colorTexture
		if (layer.getTextureType() === XRTextureType.texture) {
			subimage.colorTexture = layer.colorTextures[index]
			_textureIndex = index
		} else {
			subimage.colorTexture = layer.colorTextures[0]
			_textureIndex = 0
		}

		// initialize depthStencilTexture
		if (!layer.depthStencilTextures || !layer.depthStencilTextures.length) {
			subimage.depthStencilTexture = null
		} else if (layer.getTextureType() === XRTextureType.texture) {
			subimage.depthStencilTexture = layer.depthStencilTextures[index]
		} else {
			subimage.depthStencilTexture = layer.depthStencilTextures[0]
		}

		// Set subimage’s textureWidth to the pixel width of subimage’s colorTexture.
		// Set subimage’s textureHeight to the pixel height of subimage’s colorTexture.
		const layerMeta: PolyfillTexture = layer.colorTexturesMeta[_textureIndex]
		subimage.textureWidth = layerMeta.width
		subimage.textureHeight = layerMeta.height

		let viewsPerTexture = 1
		if (
			layer.layout === XRLayerLayout['stereo-left-right'] ||
			layer.layout === XRLayerLayout['stereo-top-bottom']
		) {
			viewsPerTexture = 2
		}

		// Run initialize viewport on subimage's viewport with subimage’s colorTexture, layer’s layout, index and num.
		// https://immersive-web.github.io/layers/#initialize-the-viewport
		initializeViewport(subimage.viewport, layerMeta, layer.layout, index, viewsPerTexture)

		// queue task to set needsRedraw to false
		this.session.queueTask(() => {
			layer.needsRedraw = false
		})

		this.subImageCache.cacheSubImage(subimage, this.context, layer, eye)
		return subimage
	}

	// This is mostly used for rendering to projection layers!
	// https://immersive-web.github.io/layers/#dom-xrwebglbinding-getviewsubimage
	public getViewSubImage(layer: XRProjectionLayer, view: XRView): XRWebGLSubImage {
		// if getViewSubImage was called previously with same binding, layer, and view, the
		// user agent may return the same subimage as returned by earlier call
		let existingSubImage = this.subImageCache.tryGetCachedViewSubImage(this.context, layer, view)
		if (existingSubImage) {
			return existingSubImage
		}

		let subimage = new XRWebGLSubImagePolyfill()

		// UNIMPLEMENTED: let frame be the view's frame
		// how do we get that?

		let session = this.session
		if (!session.internalViews || !session.internalViews.length) {
			console.warn('Tried to get view sub image before we have any views')
			return subimage
		}

		// UNIMPLEMENTED: If validate the state of the XRWebGLSubImage creation function with layer and frame is false,
		// throw an InvalidStateError and abort these steps.

		// UNIMPLEMENTED: if view's active flag is false, throw InvalidStateError
		// not relevant?

		// let index be the offset in the session's list of views.
		let index = session.getViewIndex(view)

		let _textureIndex = 0

		// initialize imageIndex
		if (layer.getTextureType() === XRTextureType['texture-array']) {
			subimage.imageIndex = index
		} else {
			subimage.imageIndex = 0
		}

		// Initialize colorTexture
		if (
			layer.layout === XRLayerLayout.default &&
			layer.getTextureType() === XRTextureType.texture
		) {
			subimage.colorTexture = layer.colorTextures[index]
			_textureIndex = index
		} else {
			subimage.colorTexture = layer.colorTextures[0]
			_textureIndex = 0
		}

		// initialize depthStencilTexture
		if (layer.depthStencilTextures.length === 0) {
			subimage.depthStencilTexture = null
		} else if (
			layer.layout === XRLayerLayout.default &&
			layer.getTextureType() === XRTextureType.texture
		) {
			subimage.depthStencilTexture = layer.depthStencilTextures[index]
		} else {
			subimage.depthStencilTexture = layer.depthStencilTextures[0]
		}

		// Set subimage’s textureWidth to the pixel width of subimage’s colorTexture.
		// Set subimage’s textureHeight to the pixel height of subimage’s colorTexture.
		subimage.textureWidth = layer.colorTexturesMeta[_textureIndex].width
		subimage.textureHeight = layer.colorTexturesMeta[_textureIndex].height

		// Run initialize viewport on subimage's viewport with subimage’s colorTexture, layer’s layout, index and num.
		// https://immersive-web.github.io/layers/#initialize-the-viewport
		initializeViewport(
			subimage.viewport,
			layer.colorTexturesMeta[_textureIndex],
			layer.layout,
			index,
			session.internalViews.length
		)

		layer.needsRedraw = false

		this.subImageCache.cacheViewSubImage(subimage, this.context, layer, view)

		return subimage
	}

	protected validateStateofSubImageCreation(
		layer: XRCompositionLayerPolyfill,
		frame: XRFrame
	): boolean {
		if (frame.session !== layer.session) {
			return false
		}
		if (this.session !== layer.session) {
			return false
		}
		if (this.context !== layer.context) {
			return false
		}
		if (!layer.colorTextures || !layer.colorTextures.length) {
			return false
		}
		if (layer.isStatic && layer.needsRedraw === false) {
			return false
		}
		return true
	}
}

class SubImageCache {
	protected cache: Map<
		XRWebGLRenderingContext,
		Map<XRCompositionLayerPolyfill, Map<XREye, XRWebGLSubImage>>
	>

	protected viewCache: Map<
		XRWebGLRenderingContext,
		Map<XRCompositionLayerPolyfill, Map<XRView, XRWebGLSubImage>>
	>
	constructor() {
		this.cache = new Map()
		this.viewCache = new Map()
	}
	public cacheSubImage(
		subimage: XRWebGLSubImage,
		context: XRWebGLRenderingContext,
		layer: XRCompositionLayerPolyfill,
		eye: XREye
	) {
		let eyeMap = new Map<XREye, XRWebGLSubImage>()
		eyeMap.set(eye, subimage)

		let layerMap = new Map<XRCompositionLayerPolyfill, Map<XREye, XRWebGLSubImage>>()
		layerMap.set(layer, eyeMap)

		this.cache.set(context, layerMap)
	}
	public tryGetCachedSubImage(
		context: XRWebGLRenderingContext,
		layer: XRCompositionLayerPolyfill,
		eye: XREye
	): XRWebGLSubImage | void {
		return this.cache.get(context)?.get(layer)?.get(eye)
	}

	public cacheViewSubImage(
		subimage: XRWebGLSubImage,
		context: XRWebGLRenderingContext,
		layer: XRCompositionLayerPolyfill,
		view: XRView
	) {
		let viewMap = new Map<XRView, XRWebGLSubImage>()
		viewMap.set(view, subimage)

		let layerMap = new Map<XRCompositionLayerPolyfill, Map<XRView, XRWebGLSubImage>>()
		layerMap.set(layer, viewMap)

		this.viewCache.set(context, layerMap)
	}

	public tryGetCachedViewSubImage(
		context: XRWebGLRenderingContext,
		layer: XRCompositionLayerPolyfill,
		view: XRView
	): XRWebGLSubImage | void {
		return this.viewCache.get(context)?.get(layer)?.get(view)
	}
}
