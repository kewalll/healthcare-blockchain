import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";  // Import Navbar
import Profile from "./pages/Profile";    // Import your pages
import Home from "./pages/Home";
import AddDoctor from "./pages/AddDoctor";
import PatientDetails from "./pages/PatientDetails";
import CreateCase from "./pages/CreateCase";
import ViewHistory from "./pages/ViewHistory";
import CaseDetails from "./pages/CaseDetails";
import PatientCaseDetails from "./pages/PatientCaseDetails";
import PatientDashboard from "./pages/PatientDashboard";
import HistorySummary from "./pages/HistorySummary";

const App = () => {
    return (
        <>
            <Navbar /> {/* ✅ Navbar added at the top */}
            <div className=""> {/* Optional container for styling */}
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/add-doctor" element={<AddDoctor />} />
                    <Route path="/patient-details" element={<PatientDetails />} />
                    <Route path="/create-case" element={<CreateCase />} />
                    <Route path="/view-history" element={<ViewHistory />} />
                    <Route path="/case-details/:caseId" element={<CaseDetails />} />
                    <Route path="/patient/case-details/:caseId" element={<PatientCaseDetails />} />
                    <Route path="/patientdashboard" element={<PatientDashboard />} />
                    <Route path="/history-summary" element={<HistorySummary />} />
                </Routes>
            </div>
        </>
    );
};

export default App;
