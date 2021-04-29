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

import XRQuadLayer from '../api/XRQuadLayer'
import { XRWebGLRenderingContext } from '../types'
import { CompositionLayerRenderer, LayerRenderer } from './base-renderer'

export class QuadRenderer extends CompositionLayerRenderer implements LayerRenderer {
	protected layer: XRQuadLayer

	constructor(layer: XRQuadLayer, context: XRWebGLRenderingContext) {
		super(layer, context)
		this.initialize()
	}

	createPositionPoints(): Float32Array {
		const width = this.layer.width
		const height = this.layer.height
		const z = 0
		const positions = [
			// bottom left
			-width,
			-height,
			z,
			// bottom right
			width,
			-height,
			z,
			// top left
			-width,
			height,
			z,
			// top left
			-width,
			height,
			z,
			// bottom right
			width,
			-height,
			z,
			// top right
			width,
			height,
			z,
		]
		return new Float32Array(positions)
	}

	createTextureUVs(): Float32Array {
		return new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0])
	}
}
