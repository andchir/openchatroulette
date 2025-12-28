import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Known virtual camera software identifiers.
 * These patterns are matched against device labels to detect virtual cameras.
 */
const VIRTUAL_CAMERA_PATTERNS = [
    // OBS Studio and related
    'obs',
    'obs virtual',
    'obs-camera',
    // ManyCam
    'manycam',
    // SplitCam
    'splitcam',
    // XSplit
    'xsplit',
    // Snap Camera (Snapchat filters)
    'snap camera',
    // CamTwist
    'camtwist',
    // Webcamoid
    'webcamoid',
    // Iriun Webcam (phone as webcam)
    'iriun',
    // DroidCam (phone as webcam)
    'droidcam',
    // EpocCam (phone as webcam)
    'epoccam',
    // NDI (Network Device Interface)
    'ndi',
    // Logitech Capture virtual camera
    'logi capture',
    // mmhmm virtual camera
    'mmhmm',
    // CamMask
    'cammask',
    // Virtual Camera generic names
    'virtual camera',
    'virtual webcam',
    'virtual cam',
    // Screen capture as camera
    'screen capture',
    'screen share',
    // Avatar/AI camera software
    'avatar',
    'animaze',
    // FaceRig
    'facerig',
    // vMix
    'vmix',
    // Streamlabs
    'streamlabs',
    // Ecamm Live
    'ecamm',
    // Prism Live
    'prism',
    // Restream
    'restream',
    // YouCam
    'youcam',
    // CyberLink
    'cyberlink',
    // AlterCam
    'altercam',
    // SplitCam
    'splitcamera',
    // ChromaCam
    'chromacam',
    // Personify
    'personify',
    // XSplit VCam
    'vcam',
];

/**
 * Data channel message type for exchanging camera device information.
 */
export const DEVICE_INFO_MESSAGE_TYPE = 'DEVICE_INFO';

/**
 * Interface for device information exchanged between peers.
 */
export interface DeviceInfoMessage {
    type: typeof DEVICE_INFO_MESSAGE_TYPE;
    deviceLabel: string;
}

/**
 * Service for detecting virtual cameras used by remote peers.
 *
 * Since WebRTC doesn't transmit device metadata (like device labels) with
 * media streams, this service facilitates the exchange of device information
 * via the WebRTC data channel. It then analyzes the remote peer's device
 * label to determine if they are using a virtual camera.
 */
@Injectable({
    providedIn: 'root'
})
export class VirtualCameraDetectorService {
    /** Observable indicating whether the remote peer is using a virtual camera */
    isVirtualCamera$ = new BehaviorSubject<boolean>(false);

    /** The detected virtual camera name, if any */
    detectedVirtualCameraName$ = new BehaviorSubject<string>('');

    constructor() {}

    /**
     * Checks if a device label indicates a virtual camera.
     * @param deviceLabel - The label of the video input device
     * @returns true if the device appears to be a virtual camera
     */
    checkDeviceLabel(deviceLabel: string): boolean {
        if (!deviceLabel) {
            return false;
        }

        const normalizedLabel = deviceLabel.toLowerCase().trim();

        return VIRTUAL_CAMERA_PATTERNS.some(pattern =>
            normalizedLabel.includes(pattern.toLowerCase())
        );
    }

    /**
     * Finds which virtual camera pattern matched the device label.
     * @param deviceLabel - The label of the video input device
     * @returns The matched pattern or empty string if no match
     */
    getMatchedPattern(deviceLabel: string): string {
        if (!deviceLabel) {
            return '';
        }

        const normalizedLabel = deviceLabel.toLowerCase().trim();

        const matchedPattern = VIRTUAL_CAMERA_PATTERNS.find(pattern =>
            normalizedLabel.includes(pattern.toLowerCase())
        );

        return matchedPattern || '';
    }

    /**
     * Processes remote peer's device information received via data channel.
     * Updates the virtual camera detection state based on the received label.
     * @param deviceLabel - The device label from the remote peer
     */
    processRemoteDeviceInfo(deviceLabel: string): void {
        const isVirtual = this.checkDeviceLabel(deviceLabel);
        this.isVirtualCamera$.next(isVirtual);

        if (isVirtual) {
            const matchedPattern = this.getMatchedPattern(deviceLabel);
            this.detectedVirtualCameraName$.next(matchedPattern);
        } else {
            this.detectedVirtualCameraName$.next('');
        }
    }

    /**
     * Creates a device info message to be sent via data channel.
     * @param deviceLabel - The local device label to send
     * @returns Serialized JSON string of the device info message
     */
    createDeviceInfoMessage(deviceLabel: string): string {
        const message: DeviceInfoMessage = {
            type: DEVICE_INFO_MESSAGE_TYPE,
            deviceLabel
        };
        return JSON.stringify(message);
    }

    /**
     * Parses a received data channel message to check if it's device info.
     * @param message - The raw message string from the data channel
     * @returns The parsed DeviceInfoMessage or null if not a device info message
     */
    parseDeviceInfoMessage(message: string): DeviceInfoMessage | null {
        try {
            const parsed = JSON.parse(message);
            if (parsed && parsed.type === DEVICE_INFO_MESSAGE_TYPE) {
                return parsed as DeviceInfoMessage;
            }
        } catch {
            // Not a JSON message, likely a regular chat message
        }
        return null;
    }

    /**
     * Resets the virtual camera detection state.
     * Should be called when disconnecting from a peer.
     */
    reset(): void {
        this.isVirtualCamera$.next(false);
        this.detectedVirtualCameraName$.next('');
    }
}
