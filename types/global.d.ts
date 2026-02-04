/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

declare global {
    interface Element {
        attributeStyleMap?: {
            set(property: string, value: any): void;
            get(property: string): any;
            clear(): void;
        };
    }

    interface OneSignalNotifications {
        addEventListener(event: 'permissionChange', handler: () => void): void;
        requestPermission(): Promise<void>;
        permission?: 'default' | 'denied' | 'granted';
    }

    interface OneSignalUserPushSubscription {
        optOut(): Promise<void>;
        optedIn?: boolean;
    }

    interface OneSignalUser {
        PushSubscription: OneSignalUserPushSubscription;
        setLanguage?(lang: string): void;
    }

    interface OneSignalLike {
        Notifications: OneSignalNotifications;
        User: OneSignalUser;
    }

    interface Window {
        OneSignal?: OneSignalLike;
        OneSignalDeferred?: Array<(oneSignal: OneSignalLike) => void>;
        scheduler?: {
            postTask<T>(callback: () => T | Promise<T>, options?: { priority?: 'user-blocking' | 'user-visible' | 'background'; signal?: AbortSignal; delay?: number }): Promise<T>;
        };
    }
}

export {};
