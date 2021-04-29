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
	XRLayerLayout,
	XRMediaCylinderLayerInit,
	XRMediaEquirectLayerInit,
	XRMediaQuadLayerInit,
	XRSessionPolyfill,
} from '../types'
import { isReferenceSpace } from '../utils/is-reference-space'
import XRCylinderLayer from './XRCylinderLayer'
import XREquirectLayer from './XREquirectLayer'
import XRQuadLayer from './XRQuadLayer'

export default class XRMediaBindingPolyfill {
	public session: XRSessionPolyfill
	constructor(session: XRSessionPolyfill) {
		this.session = session
		if ((this.session as any).ended) {
			throw new Error('Session has ended')
		}

		// UNIMPLEMENTED: If session is not an immersive session, throw an InvalidStateError and abort these steps.
	}

	public createQuadLayer(video: HTMLVideoElement, init: XRMediaQuadLayerInit): XRQuadLayer {
		if ((this.session as any).ended) {
			throw new Error('Session has ended')
		}

		if (init.layout === XRLayerLayout.default) {
			throw new TypeError('Media Quad layer cannot be created with layout of default')
		}

		let aspectRatio = this.calculateAspectRatio(video, init.layout)
		if (init.width === undefined && init.height === undefined) {
			init.width = 1
		}

		if (init.height === undefined) {
			init.height = init.width / aspectRatio
		}

		if (init.width === undefined) {
			init.width = init.height / aspectRatio
		}

		let layer = new XRQuadLayer(init, video)
		layer.needsRedraw = false

		layer.initialize(this.session)

		return layer
	}

	public createCylinderLayer(
		video: HTMLVideoElement,
		init: XRMediaCylinderLayerInit
	): XRCylinderLayer {
		if ((this.session as any).ended) {
			throw new Error('Session has ended')
		}

		if (init.layout === XRLayerLayout.default) {
			throw new TypeError('Media Cylinder layer cannot be created with layout of default')
		}

		let aspectRatio = this.calculateAspectRatio(video, init.layout)
		if (init.aspectRatio === undefined) {
			init.aspectRatio = aspectRatio
		}

		let layer = new XRCylinderLayer(init, video)
		layer.needsRedraw = false

		layer.initialize(this.session)

		return layer
	}

	public createEquirectLayer(
		video: HTMLVideoElement,
		init: XRMediaEquirectLayerInit
	): XREquirectLayer {
		if ((this.session as any).ended) {
			throw new Error('Session has ended')
		}

		if (init.layout === XRLayerLayout.default) {
			throw new TypeError('Media Equirect layer cannot be created with layout of default')
		}

		if (!isReferenceSpace(init.space)) {
			throw new Error("Media Equirect layer's space must be of type XRReferenceSpace")
		}

		// UNIMPLEMENTED: If init’s space has a type of "viewer", throw InvalidStateError and abort these steps.

		let layer = new XREquirectLayer(init, video)
		layer.needsRedraw = false

		layer.initialize(this.session)

		return layer
	}

	calculateAspectRatio(video: HTMLVideoElement, layout: XRLayerLayout): number {
		let width = video.videoWidth
		let height = video.videoHeight

		if (layout === XRLayerLayout['stereo-left-right']) {
			width /= 2
		}
		if (layout === XRLayerLayout['stereo-top-bottom']) {
			height /= 2
		}

		return width / height
	}
}
