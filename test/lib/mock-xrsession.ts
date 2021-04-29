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

import type {
	XRSession,
	XREventType,
	XREventHandler,
	XRInputSource,
	XRRenderState,
	XRVisibilityState,
	XRFrameRequestCallback,
	XRReferenceSpaceType,
	XRReferenceSpace,
	XRBoundedReferenceSpace,
	XRHitTestOptionsInit,
	XRHitTestSource,
	XRTransientInputHitTestOptionsInit,
	XRTransientInputHitTestSource,
	XRRay,
	XRHitResult,
} from 'webxr'

export class MockXRSession implements XRSession {
	public addEventListener(
		type: XREventType,
		listener: XREventHandler,
		options?: boolean | AddEventListenerOptions
	): void {}
	public removeEventListener(
		type: XREventType,
		listener: XREventHandler,
		options?: boolean | EventListenerOptions
	): void {}
	/**
	 * Returns a list of this session's XRInputSources, each representing an input device
	 * used to control the camera and/or scene.
	 */
	public inputSources: XRInputSource[] = []
	/**
	 * object which contains options affecting how the imagery is rendered.
	 * This includes things such as the near and far clipping planes
	 */
	get renderState(): XRRenderState {
		return { depthFar: 1000, depthNear: 0 }
	}

	get visibilityState(): XRVisibilityState {
		return 'hidden'
	}
	/**
	 * Removes a callback from the animation frame painting callback from
	 * XRSession's set of animation frame rendering callbacks, given the
	 * identifying handle returned by a previous call to requestAnimationFrame().
	 */
	public cancelAnimationFrame: (handle: number) => void
	/**
	 * Ends the WebXR session. Returns a promise which resolves when the
	 * session has been shut down.
	 */
	async end(): Promise<void> {}
	/**
	 * Schedules the specified method to be called the next time the user agent
	 * is working on rendering an animation frame for the WebXR device. Returns an
	 * integer value which can be used to identify the request for the purposes of
	 * canceling the callback using cancelAnimationFrame(). This method is comparable
	 * to the Window.requestAnimationFrame() method.
	 */
	public requestAnimationFrame: (callback: XRFrameRequestCallback) => number
	/**
	 * Requests that a new XRReferenceSpace of the specified export type be created.
	 * Returns a promise which resolves with the XRReferenceSpace or
	 * XRBoundedReferenceSpace which was requested, or throws a NotSupportedError if
	 * the requested space export type isn't supported by the device.
	 */
	public requestReferenceSpace(
		type: XRReferenceSpaceType
	): Promise<XRReferenceSpace | XRBoundedReferenceSpace> {
		return
	}

	public async updateRenderState(XRRenderStateInit: XRRenderState): Promise<void> {}

	onend: XREventHandler
	oninputsourceschange: XREventHandler
	onselect: XREventHandler
	onselectstart: XREventHandler
	onselectend: XREventHandler
	onsqueeze: XREventHandler
	onsqueezestart: XREventHandler
	onsqueezeend: XREventHandler
	onvisibilitychange: XREventHandler

	// hit test
	public requestHitTestSource?(options: XRHitTestOptionsInit): Promise<XRHitTestSource>
	public requestHitTestSourceForTransientInput?(
		options: XRTransientInputHitTestOptionsInit
	): Promise<XRTransientInputHitTestSource>

	// legacy AR hit test
	public requestHitTest?(ray: XRRay, referenceSpace: XRReferenceSpace): Promise<XRHitResult[]>

	// legacy plane detection
	public updateWorldTrackingState?(options: { planeDetectionState?: { enabled: boolean } }): void
}
