import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import Menu from "./Menu";
import StaffDashboard from "./StaffDashboard";

function App() {
  return (
    <div className="app-router">
      <BrowserRouter>
        <Routes>
          <Route element={<Menu />} path="/" />
          <Route element={<StaffDashboard />} path="/manager" />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
