import { useState, useRef, useEffect } from "react";
import { MenuData } from "./MenuData";
import "./Menu.css";

export default function Menu() {
  const [selectedDish, setSelectedDish] = useState(null);
  const [loading, setLoading] = useState(false);
  const viewerRef = useRef(null);

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
    glb: `${dish.model}.glb`,
    usdz: `${dish.model}.usdz`
  });

  return (
    <div className="menu-container">
      {!selectedDish && (
        <>
          <div className="menu-header">
            <h1 className="restaurant-name">🍽️ Mapolos</h1>
            <p className="menu-subtitle">Discover Culinary Excellence</p>
          </div>

          <div className="menu-grid">
            {MenuData.map((dish) => (
              <div
                key={dish.id}
                className="menu-card"
                onClick={() => {
                  setSelectedDish(dish);
                  setLoading(true);
                }}
              >
                <div className="card-header">
                  <h3 className="dish-name">{dish.name}</h3>
                  <span className="rating-badge">⭐ {dish.rating}</span>
                </div>
                <div className="card-body">
                  <div className="price-section">
                    <span className="price">Rs {dish.price}</span>
                  </div>
                  <div className="spice-section">
                    <span className="spice-label">Spice Level:</span>
                    <span className="spice-peppers">{"🌶️".repeat(dish.spice)}</span>
                  </div>
                </div>
                <div className="card-footer">
                  <span className="view-btn">View 3D Model →</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedDish && (
        <div className="dish-detail">
          <button className="back-button" onClick={() => setSelectedDish(null)}>
            ← Back to Menu
          </button>

          <div className="detail-header">
            <h2>{selectedDish.name}</h2>
          </div>

          <div className="model-container">
            {/* LOADING OVERLAY */}
            {loading && (
              <div className="loading-overlay">
                <div className="spinner" />
                <p>Loading 3D preview…</p>
              </div>
            )}

            <model-viewer
              ref={viewerRef}
              src={getModelPaths(selectedDish).glb}
              ios-src={getModelPaths(selectedDish).usdz}
              ar
              ar-modes="webxr scene-viewer quick-look"
              quick-look-browsers="safari chrome"
              camera-controls
              disable-zoom
              shadow-intensity="0.6"
            />
          </div>

          <div className="detail-info">
            <div className="info-row">
              <div className="info-item">
                <span className="info-label">Price</span>
                <span className="info-value">Rs {selectedDish.price}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Rating</span>
                <span className="info-value">⭐ {selectedDish.rating}</span>
              </div>
            </div>
            <div className="info-row">
              <div className="info-item">
                <span className="info-label">Spice Level</span>
                <span className="info-value">{"🌶️".repeat(selectedDish.spice)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
