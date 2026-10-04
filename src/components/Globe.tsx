import { useCallback, useEffect, useRef, useState } from "react";
import ReactGlobe, { type GlobeMethods } from "react-globe.gl";
import { feature } from "topojson-client";
import countriesTopology from "world-atlas/countries-110m.json";

type PointOfView = { lat: number; lng: number; altitude: number };

const STARTING_VIEW: PointOfView = { lat: 51, lng: 46, altitude: 1.65 };
const topology = countriesTopology as unknown as { type: "Topology"; objects: { countries: object } };
const countries = (feature(
  topology as Parameters<typeof feature>[0],
  topology.objects.countries as Parameters<typeof feature>[1],
) as { features: object[] }).features;

export default function Globe() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateSize = () => {
      const width = Math.max(280, Math.min(element.clientWidth, 540));
      setDimensions({ width, height: width });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const configureGlobe = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = true;
    globe.pointOfView(STARTING_VIEW, 0);
  }, []);

  return <div ref={containerRef} className="globe-stage relative mx-auto aspect-square w-full max-w-[540px] select-none" aria-label="Интерактивный глобус">
    <div className="globe-aura" aria-hidden="true"/>
    <div className="relative z-10">
      <ReactGlobe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="rgba(0,0,0,0)"
        showGraticules
        // Render the halo in CSS so it can fade beyond the canvas edges.
        showAtmosphere={false}
        polygonsData={countries}
        polygonAltitude={0.008}
        polygonCapColor={() => "rgba(41, 104, 65, 0.88)"}
        polygonSideColor={() => "rgba(9, 35, 21, 0.92)"}
        polygonStrokeColor={() => "rgba(179, 255, 199, 0.28)"}
        polygonsTransitionDuration={0}
        onGlobeReady={configureGlobe}
      />
    </div>
  </div>;
}
