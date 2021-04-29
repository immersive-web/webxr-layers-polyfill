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

import WebXRLayersPolyfill from '../src'
import { MockXRSession } from './lib/mock-xrsession'

it('should throw an error on creation if WebXR is not supported', () => {
	const createPolyfill = () => {
		return new WebXRLayersPolyfill()
	}

	expect(createPolyfill).toThrow()
})

describe('injecting polyfill', () => {
	beforeEach(() => {
		;(global as any).XRMediaBinding = undefined
		;(global as any).XRWebGLBinding = undefined
		;(global.navigator as any).xr = jest.fn(() => {
			return {}
		})
		;(global as any).XRSession = MockXRSession
	})

	it('should successfully inject polyfill if WebXR is supported and layers is not', () => {
		const polyfill = new WebXRLayersPolyfill()
		expect((polyfill as any).injected).toBe(true)
	})

	it('should not inject polyfill if XRWebGLBinding and XRMediaBinding exist natively', () => {
		;(global as any).XRMediaBinding = {}
		;(global as any).XRWebGLBinding = {}

		const polyfill = new WebXRLayersPolyfill()
		expect((polyfill as any).injected).toBe(false)
	})

	it('should mock XRWebGLBinding and XRMediaBinding if WebXR is supported', () => {
		expect((global as any).XRWebGLBinding).toBeUndefined()
		expect((global as any).XRMediaBinding).toBeUndefined()
		new WebXRLayersPolyfill()
		expect((global as any).XRWebGLBinding).toBeTruthy()
		expect((global as any).XRMediaBinding).toBeTruthy()
	})
})
