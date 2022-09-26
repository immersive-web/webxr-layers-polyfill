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

import XREquirectLayer from '../api/XREquirectLayer'
import { XRWebGLRenderingContext } from '../types'
import { CompositionLayerRenderer, LayerRenderer } from './base-renderer'

export class EquirectRenderer extends CompositionLayerRenderer implements LayerRenderer {
	protected layer: XREquirectLayer
	private segmentsPerAxis: number = 40

	constructor(layer: XREquirectLayer, context: XRWebGLRenderingContext) {
		super(layer, context)
		this.initialize()
	}

	createPositionPoints(): Float32Array {
		const positions = []

		let radius = this.layer.radius
		if (radius === 0) {
			radius = 25
		}
		// TODO investigate why a bigger radius doesn't work
		if (radius > 25) {
			radius = 25
		}

		// this uses spherical coordinates.
		// theta = the 'horizontal' axis, spanning the x and z axes Note that negative z is forward
		// phi = the 'vertical' axis, going up and down the y axis.
		const horizAngle = this.layer.centralHorizontalAngle

		// phi (vertical) values need to be mapped from 0 to pi, where 0 is the top
		// of the sphere and pi is the bottom. So we do that here...
		const phi1 = this.layer.upperVerticalAngle + Math.PI / 2
		const phi2 = this.layer.lowerVerticalAngle + Math.PI / 2

		const startPhi = phi1 // start phi. 0 for top of the sphere
		const endPhi = phi2 // end phi. pi for the bottom of the sphere
		const startTheta = Math.PI / 2 - horizAngle / 2 // start theta. 0 to start at the x axis.
		const endTheta = startTheta + horizAngle // end theta. 2pi for whole circumference

		const phiRange = endPhi - startPhi
		const thetaRange = endTheta - startTheta

		// base points
		const basePoints: number[][] = []
		for (let y = 0; y <= this.segmentsPerAxis; y++) {
			for (let x = 0; x <= this.segmentsPerAxis; x++) {
				const u = x / this.segmentsPerAxis
				const v = y / this.segmentsPerAxis
				let r = radius
				let theta = endTheta - thetaRange * u
				let phi = phiRange * v + startPhi

				const ux = Math.cos(theta) * Math.sin(phi)
				const uy = Math.cos(phi)
				// this is negative because negative z is forward...
				const uz = -Math.sin(theta) * Math.sin(phi)
				basePoints.push([r * ux, r * uy, r * uz])
			}
		}
		// now we have all the points of the sphere in...something of an order.
		// let's convert it to positions
		// if we decide to change the x and y, this should be the x
		const numVertsAround = this.segmentsPerAxis + 1
		for (let x = 0; x < this.segmentsPerAxis; x++) {
			for (let y = 0; y < this.segmentsPerAxis; y++) {
				// create the quad from those four points
				// bottom left
				positions.push(...basePoints[y * numVertsAround + x])
				// bottom right
				positions.push(...basePoints[y * numVertsAround + x + 1])
				//top left
				positions.push(...basePoints[(y + 1) * numVertsAround + x])
				//top left
				positions.push(...basePoints[(y + 1) * numVertsAround + x])
				// bottom right
				positions.push(...basePoints[y * numVertsAround + x + 1])
				// top right
				positions.push(...basePoints[(y + 1) * numVertsAround + x + 1])
			}
		}

		return new Float32Array(positions)
	}

	createTextureUVs(): Float32Array {
		const triUVs = []
		const baseUVs: number[][] = []
		for (let y = 0; y <= this.segmentsPerAxis; y++) {
			for (let x = 0; x <= this.segmentsPerAxis; x++) {
				const u = x / this.segmentsPerAxis
				const v = y / this.segmentsPerAxis

				baseUVs.push([u, v])
			}
		}
		const numVertsAround = this.segmentsPerAxis + 1
		for (let x = 0; x < this.segmentsPerAxis; x++) {
			for (let y = 0; y < this.segmentsPerAxis; y++) {
				// bottom left
				triUVs.push(...baseUVs[y * numVertsAround + x])
				// bottom right
				triUVs.push(...baseUVs[y * numVertsAround + x + 1])
				//top left
				triUVs.push(...baseUVs[(y + 1) * numVertsAround + x])
				//top left
				triUVs.push(...baseUVs[(y + 1) * numVertsAround + x])
				// bottom right
				triUVs.push(...baseUVs[y * numVertsAround + x + 1])
				// top right
				triUVs.push(...baseUVs[(y + 1) * numVertsAround + x + 1])
			}
		}
		return new Float32Array(triUVs)
	}
}
