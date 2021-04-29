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
	XRCylinderLayerInit,
	XRTextureType,
	XRMediaCylinderLayerInit,
} from '../types'
import { getGlobal } from '../utils/get-global'
import XRCompositionLayerPolyfill from './XRCompositionLayerPolyfill'

export const defaultCylinderLayerInit: XRCylinderLayerInit = {
	colorFormat: 0x1908,
	mipLevels: 1,
	layout: XRLayerLayout.mono,
	isStatic: false,
	space: null, // this is required
	viewPixelHeight: 0, // this is required
	viewPixelWidth: 0, // this is required
	textureType: XRTextureType.texture,
	radius: 2.0,
	centralAngle: 0.78539, // pi / 4
	aspectRatio: 2.0,
}

export const defaultMediaCylinderLayerInit: XRMediaCylinderLayerInit = {
	layout: XRLayerLayout.mono,
	invertStereo: false,
	space: null, // this is required
	radius: 2.0,
	centralAngle: 0.78539, // pi / 4
}

export default class XRCylinderLayer extends XRCompositionLayerPolyfill {
	public space: XRSpace
	public transform: XRRigidTransform
	public radius: number
	public centralAngle: number
	public aspectRatio: number

	protected init: XRCylinderLayerInit | XRMediaCylinderLayerInit

	constructor(init: XRCylinderLayerInit | XRMediaCylinderLayerInit, media?: HTMLVideoElement) {
		super()

		this._media = media ?? null

		if (this.isMediaLayer()) {
			this.init = { ...defaultMediaCylinderLayerInit, ...init }
		} else {
			this.init = { ...defaultCylinderLayerInit, ...init }
		}

		this.radius = this.init.radius
		this.centralAngle = this.init.centralAngle
		this.aspectRatio = this.init.aspectRatio
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
			this.isStatic = (init as XRCylinderLayerInit).isStatic
		}
	}

	public getTextureType(): XRTextureType {
		if (this.isMediaLayer()) {
			return XRTextureType.texture
		}
		return (this.init as XRCylinderLayerInit).textureType
	}

	protected _deferredInitialize() {
		let layout = this.determineLayoutAttribute(
			(this.init as XRCylinderLayerInit).textureType,
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

	get width(): number {
		// circumference of the arc
		const circumference = 2 * this.radius * Math.PI
		const percentage = this.centralAngle / (2 * Math.PI)

		return circumference * percentage
	}

	get height(): number {
		// aspect ratio is width / height
		return this.width / this.aspectRatio
	}
}
