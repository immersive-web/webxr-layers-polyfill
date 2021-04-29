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

import type { XRRigidTransform, XRSpace } from 'webxr'
import {
	XRLayerInit,
	XRLayerLayout,
	XRMediaQuadLayerInit,
	XRQuadLayerInit,
	XRTextureType,
} from '../types'
import { getGlobal } from '../utils/get-global'
import XRCompositionLayerPolyfill from './XRCompositionLayerPolyfill'

export const defaultQuadLayerInit: XRQuadLayerInit = {
	colorFormat: 0x1908,
	mipLevels: 1,
	layout: XRLayerLayout.mono,
	isStatic: false,
	space: null, // this is required
	viewPixelHeight: 0, // this is required
	viewPixelWidth: 0, // this is required
	textureType: XRTextureType.texture,
	width: 1.0,
	height: 1.0,
}

export const defaultMediaQuadLayerInit: XRMediaQuadLayerInit = {
	space: null, // this is required
	layout: XRLayerLayout.mono,
	invertStereo: false,
}

export default class XRQuadLayer extends XRCompositionLayerPolyfill {
	public space: XRSpace
	public transform: XRRigidTransform
	public width: number
	public height: number

	protected init: XRQuadLayerInit | XRMediaQuadLayerInit

	// media should only be added if it's a media layer...
	constructor(init: XRQuadLayerInit | XRMediaQuadLayerInit, media?: HTMLVideoElement) {
		super()

		this._media = media ?? null

		if (this.isMediaLayer()) {
			this.init = { ...defaultMediaQuadLayerInit, ...init }
		} else {
			this.init = { ...defaultQuadLayerInit, ...init }
		}

		this.width = this.init.width
		this.height = this.init.height
		this.space = this.init.space
		this.layout = this.init.layout

		const _global = getGlobal()
		if (this.init.transform) {
			this.transform = new _global.XRRigidTransform(
				init.transform.position,
				init.transform.orientation
			)
		} else {
			this.transform = new _global.XRRigidTransform({
				x: 0,
				y: 0,
				z: 0,
				w: 1,
			})
		}

		if (!this.isMediaLayer()) {
			this.isStatic = (init as XRQuadLayerInit).isStatic
		}
	}

	public getTextureType(): XRTextureType {
		if (this.isMediaLayer()) {
			return XRTextureType.texture
		}
		// override this please
		return (this.init as XRQuadLayerInit).textureType
	}

	protected _deferredInitialize() {
		let layout = this.determineLayoutAttribute(
			(this.init as XRQuadLayerInit).textureType,
			this.context,
			this.init.layout
		)

		this.layout = layout
		this.needsRedraw = true
	}

	get colorTextures() {
		if (this.isMediaLayer()) {
			throw new Error('Media layers do not have associated textures')
		}
		if (!this._colorTextures || !this._colorTextures.length) {
			this._allocateColorTexturesInternal(this.getTextureType(), this.init as XRLayerInit)
		}
		return this._colorTextures
	}

	get depthStencilTextures() {
		if (this.isMediaLayer()) {
			throw new Error('Media layers do not have associated textures')
		}
		if (!this._depthStencilTextures || !this._depthStencilTextures.length) {
			this._allocateDepthStencilTexturesInternal(this.getTextureType(), this.init as XRLayerInit)
		}
		return this._depthStencilTextures
	}

	// POLYFILL ONLY: Get metadata for textures
	get colorTexturesMeta() {
		if (this.isMediaLayer()) {
			throw new Error('Media layers do not have associated textures')
		}
		if (!this._colorTextures || !this._colorTextures.length) {
			this._allocateColorTexturesInternal(this.getTextureType(), this.init as XRLayerInit)
		}
		return this._texturesMeta
	}
}
