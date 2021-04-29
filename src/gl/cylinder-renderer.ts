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

import { vec2 } from 'gl-matrix'
import XRCylinderLayer from '../api/XRCylinderLayer'
import { XRWebGLRenderingContext } from '../types'
import { CompositionLayerRenderer, LayerRenderer } from './base-renderer'

export class CylinderRenderer extends CompositionLayerRenderer implements LayerRenderer {
	protected layer: XRCylinderLayer

	private segments: number = 16

	constructor(layer: XRCylinderLayer, context: XRWebGLRenderingContext) {
		super(layer, context)
		this.initialize()
	}

	createPositionPoints(): Float32Array {
		const positions = []

		// assume the central point is (0, 0, 0)

		const angle = this.layer.centralAngle
		const height = this.layer.height
		const radius = this.layer.radius

		const radiansPerSegment = angle / this.segments
		const theta = Math.PI / 2 - angle / 2
		const unitCirclePositions = []
		// first point - on the right. We'll eventually have to flip the aray
		const firstUnitPoint = vec2.create()
		firstUnitPoint[0] = radius * Math.cos(theta)
		firstUnitPoint[1] = -radius * Math.sin(theta)
		unitCirclePositions.push(firstUnitPoint)

		for (let i = 0; i < this.segments; i++) {
			const nextPoint = vec2.create()
			nextPoint[0] = radius * Math.cos(theta + radiansPerSegment * (i + 1))
			nextPoint[1] = -radius * Math.sin(theta + radiansPerSegment * (i + 1))
			unitCirclePositions.push(nextPoint)
		}

		// flip the array to get the segments on the unit circle
		unitCirclePositions.reverse()

		for (let i = 0; i < this.segments; i++) {
			const u = unitCirclePositions[i]
			const v = unitCirclePositions[i + 1]

			// we need six points per quad:

			// bottom left
			positions.push(u[0], -height / 2, u[1])
			// bottom right
			positions.push(v[0], -height / 2, v[1])
			//top left
			positions.push(u[0], height / 2, u[1])
			//top left
			positions.push(u[0], height / 2, u[1])
			// bottom right
			positions.push(v[0], -height / 2, v[1])
			// top right
			positions.push(v[0], height / 2, v[1])
		}

		return new Float32Array(positions)
	}

	createTextureUVs(): Float32Array {
		let textureUVs = []
		const texturePercent = 1.0 / this.segments
		// texture UVs are 2D. We still need 6 vertices per quad.
		for (let i = 0; i < this.segments; i++) {
			let leftX = texturePercent * i
			let rightX = texturePercent * (i + 1)
			// bottom left
			textureUVs.push(leftX, 0)
			// bottom right
			textureUVs.push(rightX, 0)
			// top left
			textureUVs.push(leftX, 1)
			// top left
			textureUVs.push(leftX, 1)
			// bottom right
			textureUVs.push(rightX, 0)
			// top right
			textureUVs.push(rightX, 1)
		}

		return new Float32Array(textureUVs)
	}
}
