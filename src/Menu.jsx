import { useState, useRef, useEffect } from "react";
import { MenuData } from "./MenuData";

export default function Menu() {
  const [selectedDish, setSelectedDish] = useState(null);
  const [loading, setLoading] = useState(false);
  const viewerRef = useRef(null);

  // Device detection
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  useEffect(() => {
    if (!viewerRef.current) return;

    const viewer = viewerRef.current;

    const onLoad = () => setLoading(false);
    const onProgress = (event) => {
      if (event.detail.totalProgress < 1) {
        setLoading(true);
      }
    };

    viewer.addEventListener("load", onLoad);
    viewer.addEventListener("progress", onProgress);

    return () => {
      viewer.removeEventListener("load", onLoad);
      viewer.removeEventListener("progress", onProgress);
    };
  }, [selectedDish]);

  // Get model paths based on dish id
  const getModelPaths = (dish) => ({
    glb: `/models/${dish.id}.glb`,
    usdz: `/models/${dish.id}.usdz`
  });

  return (
    <div style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h2>Restaurant Menu</h2>

      {!selectedDish && (
        <div>
          {MenuData.map((dish) => (
            <div
              key={dish.id}
              onClick={() => {
                setSelectedDish(dish);
                setLoading(true);
              }}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
                cursor: "pointer"
              }}
            >
              <h3>{dish.name}</h3>
              <p>Rs {dish.price}</p>
              <p>Spice: {"🌶️".repeat(dish.spice)}</p>
              <p>⭐ {dish.rating}</p>
            </div>
          ))}
        </div>
      )}

      {selectedDish && (
        <div style={{ position: "relative" }}>
          <button onClick={() => setSelectedDish(null)}>← Back</button>

          <h3>{selectedDish.name}</h3>

          {/* LOADING OVERLAY */}
          {loading && (
            <div
              style={{
                position: "absolute",
                top: 80,
                left: 0,
                right: 0,
                height: "60vh",
                background: "rgba(255,255,255,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                flexDirection: "column"
              }}
            >
              <div className="spinner" />
              <p>Loading 3D preview…</p>
            </div>
          )}

          <model-viewer
            ref={viewerRef}
            src={isIOS() ? getModelPaths(selectedDish).usdz : getModelPaths(selectedDish).glb}
            ios-src={getModelPaths(selectedDish).usdz} // required for iOS Quick Look
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            disable-zoom
            shadow-intensity="0.6"
            style={{ width: "100%", height: "60vh" }}
          />

          <p>Price: Rs {selectedDish.price}</p>
          <p>Spice: {"🌶️".repeat(selectedDish.spice)}</p>
          <p>Rating: ⭐ {selectedDish.rating}</p>
        </div>
      )}
    </div>
  );
}
