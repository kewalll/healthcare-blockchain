import { useState, useEffect } from "react";
import { useBlockchain } from "../context/BlockchainContext";
import Chatbot from "../components/Chatbot";

const PatientDashboard = () => {
  const { account, contract } = useBlockchain();
  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]); // open cases
  const [closedCasesCount, setClosedCasesCount] = useState(0);
  const [recentMedication, setRecentMedication] = useState("None prescribed");
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Helper function to format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000); // Convert from seconds to milliseconds
    return date.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Helper function to get activity color based on type
  const getActivityColor = (activityType) => {
    switch (activityType) {
      case "records_accessed":
        return "border-blue-500";
      case "prescription_updated":
        return "border-yellow-500";
      case "appointment_completed":
        return "border-green-500";
      case "case_created":
        return "border-purple-500";
      case "record_added":
        return "border-indigo-500";
      case "report_added":
        return "border-pink-500";
      case "case_closed":
        return "border-red-500";
      case "patient_registration":
        return "border-emerald-500";
      default:
        return "border-gray-500";
    }
  };

  // Helper function to get activity icon
  const getActivityIcon = (activityType) => {
    switch (activityType) {
      case "records_accessed":
        return "👁️";
      case "prescription_updated":
        return "💊";
      case "appointment_completed":
        return "✅";
      case "case_created":
        return "📋";
      case "record_added":
        return "📝";
      case "report_added":
        return "📄";
      case "case_closed":
        return "🔒";
      case "patient_registration":
        return "👤";
      default:
        return "📌";
    }
  };

  // Fetch recent activities from the blockchain
  const fetchActivities = async () => {
    if (!contract || !account) return;

    setLoadingActivities(true);
    try {
      const recentActivities = await contract.getRecentActivities(10);

      const formattedActivities = await Promise.all(
        recentActivities
          .filter((activity) => activity.isVisible)
          .map(async (activity) => {
            let actorName = "Unknown";
            try {
              const actorDetails = await contract.patients(activity.actor);
              if (actorDetails && actorDetails.fullName) {
                actorName = actorDetails.fullName;
              }
            } catch (err) {
              console.error(`No details for actor ${activity.actor}`, err);
            }

            return {
              id: activity.activityId.toString(),
              type: activity.activityType,
              description: activity.description,
              timestamp: activity.timestamp.toString(),
              actor: activity.actor,
              actorName, // ✅ added doctor/patient name
              caseId: activity.relatedCaseId.toString(),
              recordId: activity.relatedRecordId.toString(),
            };
          })
      );

      setActivities(formattedActivities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      setActivities([]);
    }
    setLoadingActivities(false);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!contract || !account) return;
      try {
        // Patient details
        const data = await contract.patients(account);
        setUser({
          name: data.fullName,
          wallet: account,
          dateOfBirth: data.dob,
          contactNumber: data.contactNumber,
          address: data.addressDetails,
          weight: data.weight.toString(),
          height: data.height.toString(),
          allergies: data.allergies,
        });
      } catch (err) {
        console.log(err);
        setUser(null);
      }
      let openCases = [];
      let closedCases = 0;
      try {
        // Cases
        const [caseIds, caseTitles] = await contract.getMyCases();
        // Fetch open and closed cases
        const caseStatusArr = await Promise.all(
          caseIds.map(async (id, idx) => {
            const details = await contract.getMyCaseDetails(id);
            return {
              isOngoing: details.isOngoing,
              id: id.toString(),
              title: caseTitles[idx],
            };
          })
        );
        openCases = caseStatusArr
          .filter((c) => c.isOngoing)
          .map((c) => ({ id: c.id, title: c.title }));
        closedCases = caseStatusArr.filter((c) => !c.isOngoing).length;
        setCases(openCases);
        setClosedCasesCount(closedCases);
      } catch (err) {
        console.log(err);
        setCases([]);
        setClosedCasesCount(0);
      }
      // Fetch recent medication from latest record of each open case
      try {
        let meds = [];
        for (const c of openCases) {
          const records = await contract.getMyCaseRecords(c.id);
          if (records.length > 0) {
            const latestRecord = records[records.length - 1];
            if (
              latestRecord.medications &&
              latestRecord.medications.trim() !== ""
            ) {
              meds.push(latestRecord.medications);
            }
          }
        }
        setRecentMedication(
          meds.length > 0 ? meds.join(", ") : "None prescribed"
        );
      } catch (err) {
        console.log(err);
        setRecentMedication("None prescribed");
      }

      // Fetch activities after other data
      await fetchActivities();

      setLoading(false);
    };
    fetchData();
  }, [contract, account]);

  // Function to refresh activities
  const refreshActivities = async () => {
    await fetchActivities();
  };

  // Function to toggle activity visibility
  const toggleActivityVisibility = async (activityId) => {
    try {
      await contract.toggleActivityVisibility(activityId);
      // Refresh activities after toggling
      await fetchActivities();
    } catch (error) {
      console.error("Error toggling activity visibility:", error);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="bg-gray-900 rounded-lg p-8 mb-8">
          <h1 className="text-3xl font-semibold mb-2">
            Welcome back, {user?.name || "Patient"}
          </h1>
          <p className="text-gray-400">
            Your health records are securely stored on the blockchain
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Next Appointment</p>
              <p className="font-medium">No upcoming appointments</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Recent Medications</p>
              <p className="font-medium">{recentMedication}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Cases</p>
              <p className="font-medium">
                Open: {cases.length} | Closed: {closedCasesCount}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Insurance Status</p>
              <p className="font-medium">Not Available</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-8 mb-8">
          <h2 className="text-xl font-semibold mb-6">Medical Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="mb-4">
                <p className="text-gray-400 text-sm">Full Name</p>
                <p>{user?.name}</p>
              </div>
              <div className="mb-4">
                <p className="text-gray-400 text-sm">Date of Birth</p>
                <p>{user?.dateOfBirth}</p>
              </div>
              <div className="mb-4">
                <p className="text-gray-400 text-sm">Contact Number</p>
                <p>{user?.contactNumber}</p>
              </div>
              <div className="mb-4">
                <p className="text-gray-400 text-sm">Weight</p>
                <p>{user?.weight}</p>
              </div>
            </div>
            <div>
              <div className="mb-4">
                <p className="text-gray-400 text-sm">Wallet Address</p>
                <p className="flex items-center">
                  <span>{user?.wallet}</span>
                  <span className="ml-2 bg-green-500 text-black text-xs px-2 py-1 rounded">
                    Patient
                  </span>
                </p>
              </div>
              <div className="mb-4">
                <p className="text-gray-400 text-sm">Address</p>
                <p>{user?.address}</p>
              </div>
              <div className="mb-4">
                <p className="text-gray-400 text-sm">Height</p>
                <p>{user?.height}</p>
              </div>
              <div className="mb-4">
                <p className="text-gray-400 text-sm">Allergies</p>
                <p>{user?.allergies}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cases Section */}
        <div className="bg-gray-900 rounded-lg p-8 mb-8">
          <h2 className="text-xl font-semibold mb-6">Your Open Cases</h2>
          {cases.length === 0 ? (
            <p className="text-gray-400">No cases found.</p>
          ) : (
            <ul className="list-disc ml-6">
              {cases.map((c) => (
                <li key={c.id} className="mb-2">
                  <span className="font-medium">{c.title}</span>{" "}
                  <span className="text-gray-400">(ID: {c.id})</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Enhanced Recent Activity */}
        <div className="bg-gray-900 rounded-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
            <div className="flex space-x-2">
              <button
                onClick={refreshActivities}
                disabled={loadingActivities}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-1 rounded text-sm transition-colors"
              >
                {loadingActivities ? "🔄" : "🔄"} Refresh
              </button>
            </div>
          </div>

          {loadingActivities ? (
            <div className="text-center py-8">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-green-500 rounded-full"></div>
              <p className="text-gray-400 mt-2">Loading activities...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No recent activities found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className={`border-l-4 ${getActivityColor(
                    activity.type
                  )} pl-4 py-3 bg-gray-800 rounded-r-lg relative group`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <span className="text-lg">
                        {getActivityIcon(activity.type)}
                      </span>
                      <div>
                        <p className="font-medium flex items-center">
                          {activity.description}
                          {activity.type === "records_accessed" && (
                            <span className="ml-2 bg-blue-600 text-xs px-2 py-1 rounded">
                              Access
                            </span>
                          )}
                          {activity.type === "prescription_updated" && (
                            <span className="ml-2 bg-yellow-600 text-xs px-2 py-1 rounded">
                              Update
                            </span>
                          )}
                          {activity.type === "appointment_completed" && (
                            <span className="ml-2 bg-green-600 text-xs px-2 py-1 rounded">
                              Complete
                            </span>
                          )}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {formatTimestamp(activity.timestamp)}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          Actor: {activity.actorName} ({activity.actor})
                        </p>
                        {activity.caseId !== "0" && (
                          <p className="text-gray-500 text-xs mt-1">
                            Case ID: {activity.caseId}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Privacy Control Button */}
                    <button
                      onClick={() => toggleActivityVisibility(activity.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-700 hover:bg-gray-600 p-1 rounded text-xs"
                      title="Hide this activity"
                    >
                      👁️‍🗨️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activities.length > 0 && (
            <div className="mt-6 text-center">
              <button className="text-green-500 hover:text-green-400 text-sm underline">
                View All Activities
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Schedule Appointment Button */}
      <div className="fixed bottom-8 right-8">
        <Chatbot />
      </div>

      {/* Decorative Dots */}
      <div className="fixed top-1/4 left-8 w-2 h-2 bg-green-500 rounded-full"></div>
      <div className="fixed bottom-1/4 left-8 w-2 h-2 bg-green-500 rounded-full"></div>
      <div className="fixed top-1/4 right-8 w-2 h-2 bg-green-500 rounded-full"></div>
      <div className="fixed bottom-1/4 right-8 w-2 h-2 bg-green-500 rounded-full"></div>
    </div>
  );
};

export default PatientDashboard;
