import logo from './logo.svg';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Menu from "./Menu";
import Demo from "./Demo";

function App() {
  <script
  type="module"
  src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js">
</script>

  return (
    <div className="App">
 <BrowserRouter>
      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/menu" replace />} />

        {/* Menu page (QR opens this) */}
        <Route path="/menu" element={<Menu />} />

        {/* Demo / test page */}
        <Route path="/demo" element={<Demo />} />

        {/* Fallback for unknown routes */}
        <Route path="*" element={<Navigate to="/menu" replace />} />
      </Routes>
    </BrowserRouter>
        {/* <Menu/> */}
    </div>
  );
}

export default App;
