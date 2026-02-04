/**
 * TypeScript declarations for Google Maps 3D JavaScript API
 * Augments the official @types/google.maps with missing 3D features
 * @see https://developers.google.com/maps/documentation/javascript/reference/3d-map
 */

// Use module augmentation to extend the official types
import "@types/google.maps";

declare global {
  namespace google.maps {
    // Map mode - not in official types yet
    type MapMode = "SATELLITE" | "HYBRID";
  }

  namespace google.maps.maps3d {
    // Camera options for fly animations
    interface CameraOptions {
      center?: google.maps.LatLngAltitudeLiteral;
      tilt?: number;
      heading?: number;
      range?: number;
    }

    interface FlyCameraToOptions {
      endCamera: CameraOptions;
      durationMillis?: number;
    }

    interface FlyCameraAroundOptions {
      camera: CameraOptions;
      durationMillis?: number;
      repeatCount?: number;
    }

    // Marker3DElement - not in official types yet
    interface Marker3DElementOptions {
      position?: google.maps.LatLngAltitudeLiteral;
      altitudeMode?: AltitudeMode;
      extruded?: boolean;
      label?: string;
    }

    interface Marker3DInteractiveElementOptions extends Marker3DElementOptions {}

    class Marker3DElement extends HTMLElement {
      constructor(options?: Marker3DElementOptions);
      position: google.maps.LatLngAltitudeLiteral;
      altitudeMode: AltitudeMode;
      extruded: boolean;
      label: string;
    }

    class Marker3DInteractiveElement extends Marker3DElement {
      constructor(options?: Marker3DInteractiveElementOptions);
    }
  }

  // Augment Maps3DLibrary with missing exports
  namespace google.maps {
    interface Maps3DLibrary {
      AltitudeMode: typeof google.maps.maps3d.AltitudeMode;
      Marker3DElement: typeof google.maps.maps3d.Marker3DElement;
      Marker3DInteractiveElement: typeof google.maps.maps3d.Marker3DInteractiveElement;
    }

    // Augment Map3DElementOptions
    namespace maps3d {
      interface Map3DElementOptions {
        mode?: google.maps.MapMode;
      }

      // Augment Map3DElement with missing methods
      interface Map3DElement {
        mode: google.maps.MapMode;
        flyCameraTo(options: FlyCameraToOptions): void;
        flyCameraAround(options: FlyCameraAroundOptions): void;
        stopCameraAnimation(): void;
      }

      // Augment Polyline3DElement with path property
      interface Polyline3DElement {
        path: google.maps.LatLngAltitudeLiteral[];
      }
    }
  }
}

export {};
