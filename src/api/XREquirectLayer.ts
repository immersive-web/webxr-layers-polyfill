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
	XREquirectLayerInit,
	XRLayerInit,
	XRLayerLayout,
	XRMediaEquirectLayerInit,
	XRTextureType,
} from '../types'
import { getGlobal } from '../utils/get-global'
import { isReferenceSpace } from '../utils/is-reference-space'
import XRCompositionLayerPolyfill from './XRCompositionLayerPolyfill'

export const defaultEquirectLayerInit: XREquirectLayerInit = {
	colorFormat: 0x1908,
	mipLevels: 1,
	layout: XRLayerLayout.mono,
	isStatic: false,
	space: null, // this is required
	viewPixelHeight: 0, // this is required
	viewPixelWidth: 0, // this is required
	textureType: XRTextureType.texture,
	radius: 0,
	centralHorizontalAngle: 6.28318, // 2pi
	upperVerticalAngle: 1.570795, // pi/2
	lowerVerticalAngle: -1.570795, // -pi/2
}

export const defaultMediaEquirectLayerInit: XRMediaEquirectLayerInit = {
	space: null, // this is required
	layout: XRLayerLayout.mono,
	invertStereo: false,
	radius: 0,
	centralHorizontalAngle: 6.28318, // 2pi
	upperVerticalAngle: 1.570795, // pi/2
	lowerVerticalAngle: -1.570795, // -pi/2
}

export default class XREquirectLayer extends XRCompositionLayerPolyfill {
	public space: XRSpace
	public transform: XRRigidTransform

	public radius: number
	public centralHorizontalAngle: number
	public upperVerticalAngle: number
	public lowerVerticalAngle: number

	protected init: XREquirectLayerInit | XRMediaEquirectLayerInit

	constructor(init: XREquirectLayerInit | XRMediaEquirectLayerInit, media?: HTMLVideoElement) {
		super()
		this._media = media ?? null

		if (this.isMediaLayer()) {
			this.init = { ...defaultMediaEquirectLayerInit, ...init }
		} else {
			this.init = { ...defaultEquirectLayerInit, ...init }
		}

		if (!isReferenceSpace(this.init.space)) {
			throw new TypeError("Equirect layer's space needs to be an XRReferenceSpace")
		}

		// UNIMPLEMENTED: If init's space has a type of 'viewer', throw TypeError and abort these steps.

		this.radius = this.init.radius
		this.centralHorizontalAngle = this.init.centralHorizontalAngle
		this.upperVerticalAngle = this.init.upperVerticalAngle
		this.lowerVerticalAngle = this.init.lowerVerticalAngle
		this.space = this.init.space
		this.layout = this.init.layout

		const _global = getGlobal()
		if (init.transform) {
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
			this.isStatic = (init as XREquirectLayerInit).isStatic
		}
	}

	public getTextureType(): XRTextureType {
		if (this.isMediaLayer()) {
			return XRTextureType.texture
		}
		return (this.init as XREquirectLayerInit).textureType
	}

	protected _deferredInitialize() {
		let layout = this.determineLayoutAttribute(
			(this.init as XREquirectLayerInit).textureType,
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
