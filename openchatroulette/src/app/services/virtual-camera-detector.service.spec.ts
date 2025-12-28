import { TestBed } from '@angular/core/testing';

import {
    VirtualCameraDetectorService,
    DEVICE_INFO_MESSAGE_TYPE
} from './virtual-camera-detector.service';

describe('VirtualCameraDetectorService', () => {
    let service: VirtualCameraDetectorService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(VirtualCameraDetectorService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('checkDeviceLabel', () => {
        it('should return false for empty label', () => {
            expect(service.checkDeviceLabel('')).toBeFalse();
        });

        it('should return false for regular camera labels', () => {
            expect(service.checkDeviceLabel('FaceTime HD Camera')).toBeFalse();
            expect(service.checkDeviceLabel('Logitech C920 HD Pro Webcam')).toBeFalse();
            expect(service.checkDeviceLabel('Integrated Webcam')).toBeFalse();
            expect(service.checkDeviceLabel('USB Camera')).toBeFalse();
        });

        it('should return true for OBS virtual camera', () => {
            expect(service.checkDeviceLabel('OBS Virtual Camera')).toBeTrue();
            expect(service.checkDeviceLabel('OBS-Camera')).toBeTrue();
            expect(service.checkDeviceLabel('obs virtual')).toBeTrue();
        });

        it('should return true for ManyCam', () => {
            expect(service.checkDeviceLabel('ManyCam Virtual Webcam')).toBeTrue();
            expect(service.checkDeviceLabel('ManyCam')).toBeTrue();
        });

        it('should return true for SplitCam', () => {
            expect(service.checkDeviceLabel('SplitCam Video Driver')).toBeTrue();
        });

        it('should return true for XSplit', () => {
            expect(service.checkDeviceLabel('XSplit VCam')).toBeTrue();
            expect(service.checkDeviceLabel('XSplit Broadcaster')).toBeTrue();
        });

        it('should return true for phone-as-webcam apps', () => {
            expect(service.checkDeviceLabel('Iriun Webcam')).toBeTrue();
            expect(service.checkDeviceLabel('DroidCam Source')).toBeTrue();
            expect(service.checkDeviceLabel('EpocCam Camera')).toBeTrue();
        });

        it('should return true for other virtual cameras', () => {
            expect(service.checkDeviceLabel('Snap Camera')).toBeTrue();
            expect(service.checkDeviceLabel('CamTwist')).toBeTrue();
            expect(service.checkDeviceLabel('NDI Video')).toBeTrue();
        });

        it('should be case insensitive', () => {
            expect(service.checkDeviceLabel('OBS VIRTUAL CAMERA')).toBeTrue();
            expect(service.checkDeviceLabel('manycam')).toBeTrue();
            expect(service.checkDeviceLabel('SPLITCAM')).toBeTrue();
        });
    });

    describe('getMatchedPattern', () => {
        it('should return empty string for empty label', () => {
            expect(service.getMatchedPattern('')).toBe('');
        });

        it('should return empty string for non-virtual camera', () => {
            expect(service.getMatchedPattern('FaceTime HD Camera')).toBe('');
        });

        it('should return matched pattern for virtual camera', () => {
            expect(service.getMatchedPattern('OBS Virtual Camera')).toBe('obs');
            expect(service.getMatchedPattern('ManyCam Virtual Webcam')).toBe('manycam');
        });
    });

    describe('processRemoteDeviceInfo', () => {
        it('should set isVirtualCamera$ to true for virtual cameras', () => {
            service.processRemoteDeviceInfo('OBS Virtual Camera');
            expect(service.isVirtualCamera$.getValue()).toBeTrue();
        });

        it('should set isVirtualCamera$ to false for regular cameras', () => {
            service.processRemoteDeviceInfo('FaceTime HD Camera');
            expect(service.isVirtualCamera$.getValue()).toBeFalse();
        });

        it('should set detectedVirtualCameraName$ for virtual cameras', () => {
            service.processRemoteDeviceInfo('ManyCam Virtual Webcam');
            expect(service.detectedVirtualCameraName$.getValue()).toBe('manycam');
        });

        it('should clear detectedVirtualCameraName$ for regular cameras', () => {
            // First set a virtual camera
            service.processRemoteDeviceInfo('OBS Virtual Camera');
            expect(service.detectedVirtualCameraName$.getValue()).toBe('obs');

            // Then set a regular camera
            service.processRemoteDeviceInfo('Logitech Webcam');
            expect(service.detectedVirtualCameraName$.getValue()).toBe('');
        });
    });

    describe('createDeviceInfoMessage', () => {
        it('should create a valid JSON message', () => {
            const message = service.createDeviceInfoMessage('Test Camera');
            const parsed = JSON.parse(message);
            expect(parsed.type).toBe(DEVICE_INFO_MESSAGE_TYPE);
            expect(parsed.deviceLabel).toBe('Test Camera');
        });
    });

    describe('parseDeviceInfoMessage', () => {
        it('should parse a valid device info message', () => {
            const message = JSON.stringify({
                type: DEVICE_INFO_MESSAGE_TYPE,
                deviceLabel: 'Test Camera'
            });
            const result = service.parseDeviceInfoMessage(message);
            expect(result).not.toBeNull();
            expect(result?.deviceLabel).toBe('Test Camera');
        });

        it('should return null for regular chat messages', () => {
            const result = service.parseDeviceInfoMessage('Hello, how are you?');
            expect(result).toBeNull();
        });

        it('should return null for other JSON messages', () => {
            const message = JSON.stringify({ type: 'OTHER_TYPE', data: 'test' });
            const result = service.parseDeviceInfoMessage(message);
            expect(result).toBeNull();
        });
    });

    describe('reset', () => {
        it('should reset all state', () => {
            // Set some state
            service.processRemoteDeviceInfo('OBS Virtual Camera');
            expect(service.isVirtualCamera$.getValue()).toBeTrue();
            expect(service.detectedVirtualCameraName$.getValue()).toBe('obs');

            // Reset
            service.reset();
            expect(service.isVirtualCamera$.getValue()).toBeFalse();
            expect(service.detectedVirtualCameraName$.getValue()).toBe('');
        });
    });
});
