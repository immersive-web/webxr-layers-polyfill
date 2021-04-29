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

import type { XRSession, XRSessionMode } from 'webxr'
import XRMediaBindingPolyfill from './api/XRMediaBinding'
import { XRSessionWithLayer } from './api/XRSessionWithLayer'
import XRWebGLBindingPolyfill from './api/XRWebGLBinding'
import { XRSessionPolyfill } from './types'
import { getGlobal } from './utils/get-global'
import { isLayersNativelySupported } from './utils/is-layers-supported'

export default class WebXRLayersPolyfill {
	protected injected = false
	constructor() {
		const _global = getGlobal()
		this._injectPolyfill(_global)
	}

	_injectPolyfill(global: any) {
		if (!('xr' in global.navigator)) {
			throw new Error('WebXR Layers polyfill requires WebXR support.')
		}

		if (this.injected === true) {
			console.warn('Polyfill has already been injected...')
		}

		if (isLayersNativelySupported(global)) {
			// we don't need to polyfill anything, so leave things untouched
			return
		}

		this._polyfillRequiredLayersFeature(global)
		this._polyfillXRSession(global)

		global.XRWebGLBinding = XRWebGLBindingPolyfill
		global.XRMediaBinding = XRMediaBindingPolyfill

		this.injected = true
		console.log('Injected Layers Polyfill')
	}

	_polyfillXRSession(global: any) {
		global.XRSession.prototype._updateRenderState = global.XRSession.prototype.updateRenderState
		global.XRSession.prototype._requestAnimationFrame =
			global.XRSession.prototype.requestAnimationFrame

		let renderStateGetter = Object.getOwnPropertyDescriptor(
			global.XRSession.prototype,
			'renderState'
		)
		Object.defineProperty(global.XRSession.prototype, '_renderState', renderStateGetter)

		let polyfillRenderStateGetter = Object.getOwnPropertyDescriptor(
			XRSessionWithLayer.prototype,
			'renderState'
		)
		Object.defineProperty(global.XRSession.prototype, 'renderState', polyfillRenderStateGetter)

		// this lets us grab all the functions and getters from XRSesssionWithLayer and put them into XRSession
		let prototypeNames = Object.getOwnPropertyNames(XRSessionWithLayer.prototype)
		for (let item of prototypeNames) {
			let propertyDescriptor = Object.getOwnPropertyDescriptor(XRSessionWithLayer.prototype, item)
			Object.defineProperty(global.XRSession.prototype, item, propertyDescriptor)
		}
	}

	// This is a glorious hack to remove the 'layers' string from requiredFeatures so that XRSystem doesn't
	// throw an error when we try to request a session.
	_polyfillRequiredLayersFeature(global: any) {
		const existingRequestSession = global.navigator.xr.requestSession
		Object.defineProperty(global.navigator.xr, 'requestSessionInternal', { writable: true })
		global.navigator.xr.requestSessionInternal = existingRequestSession

		const newRequestSession = (
			sessionMode: XRSessionMode,
			sessionInit?: any
		): Promise<XRSession> => {
			const modifiedSessionPromise = (mode: XRSessionMode, init?: any): Promise<XRSession> => {
				return global.navigator.xr.requestSessionInternal(mode, init).then((session: XRSession) => {
					// create internal required variables
					Object.assign(session, new XRSessionWithLayer())
					let polyfilledSession: XRSessionPolyfill = session as XRSessionPolyfill
					polyfilledSession.initializeSession(sessionMode)
					return Promise.resolve(polyfilledSession)
				})
			}
			// we don't have to do anything if we aren't in VR or don't require layers
			if (sessionMode !== 'immersive-vr') {
				return modifiedSessionPromise(sessionMode, sessionInit)
			}

			if (!sessionInit) {
				return modifiedSessionPromise(sessionMode, sessionInit)
			}

			if (sessionInit.requiredFeatures && sessionInit.requiredFeatures.indexOf('layers') > -1) {
				// create a clone of the sessionInit to avoid mutating it (in case the client wants to inspect it)
				const sessionInitClone = { ...sessionInit }
				// remove layers from the requiredFeatures
				const reqFeatures: string[] = [...sessionInit.requiredFeatures]
				const layersIndex = reqFeatures.indexOf('layers')
				reqFeatures.splice(layersIndex, 1)
				sessionInitClone.requiredFeatures = reqFeatures
				return modifiedSessionPromise(sessionMode, sessionInitClone)
			}
			return modifiedSessionPromise(sessionMode, sessionInit)
		}

		Object.defineProperty(global.navigator.xr, 'requestSession', { writable: true })
		global.navigator.xr.requestSession = newRequestSession
	}
}
