// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract Healthcare {
    struct Patient {
        string fullName;
        string dob;
        string addressDetails;
        string contactNumber;
        string allergies;
        uint256 weight;
        uint256 height;
        uint256[] caseIds;
        uint256 passcodeHash;
    }

    struct MedicalCase {
        uint256 caseId;
        address patient;
        bool isOngoing;
        string caseTitle;
        uint256[] recordIds;
        string[] reportCIDs;
    }

    struct MedicalRecord {
        uint256 recordId;
        uint256 caseId;
        address doctor;
        string symptoms;
        string cause;
        string inference;
        string prescription;
        string advices;
        string medications;
    }

    // New Activity Tracking Structures
    struct Activity {
        uint256 activityId;
        address patient;
        address actor; // Who performed the action (doctor, patient, etc.)
        string activityType; // "record_access", "prescription_update", "appointment_complete", etc.
        string description;
        uint256 timestamp;
        uint256 relatedCaseId; // 0 if not case-related
        uint256 relatedRecordId; // 0 if not record-related
        bool isVisible; // For privacy control
    }

    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isDoctor;
    mapping(address => Patient) public patients;
    mapping(uint256 => MedicalCase) public cases;
    mapping(uint256 => MedicalRecord) public records;
    address[] public doctorList;

    // Activity Tracking Mappings
    mapping(uint256 => Activity) public activities;
    mapping(address => uint256[]) public patientActivities; // Patient address -> activity IDs
    mapping(address => uint256) public lastAccessTime; // Track last access for each user

    uint256 public caseCounter;
    uint256 public recordCounter;
    uint256 public activityCounter; // New counter for activities

    // Existing Events
    event DoctorAssigned(address indexed doctor);
    event PatientRegistered(address indexed patient, string fullName);
    event CaseCreated(
        uint256 indexed caseId,
        address indexed patient,
        string caseTitle
    );
    event RecordAdded(
        uint256 indexed recordId,
        uint256 indexed caseId,
        address indexed doctor
    );
    event ReportAdded(uint256 indexed caseId, string cid);
    event CaseClosed(uint256 indexed caseId);

    // New Activity Events
    event ActivityLogged(
        uint256 indexed activityId,
        address indexed patient,
        address indexed actor,
        string activityType
    );
    event RecordsAccessed(
        address indexed patient,
        address indexed doctor,
        uint256 indexed caseId
    );
    event PrescriptionUpdated(
        address indexed patient,
        address indexed doctor,
        uint256 indexed recordId
    );

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Only admin can perform this action");
        _;
    }

    modifier onlyDoctor() {
        require(isDoctor[msg.sender], "Only doctor can perform this action");
        _;
    }

    modifier onlyPatient() {
        require(
            bytes(patients[msg.sender].fullName).length > 0,
            "Not a registered patient"
        );
        _;
    }

    constructor() {
        isAdmin[msg.sender] = true;
    }

    // Internal function to log activities
    function _logActivity(
        address _patient,
        address _actor,
        string memory _activityType,
        string memory _description,
        uint256 _relatedCaseId,
        uint256 _relatedRecordId
    ) internal {
        activityCounter++;
        
        activities[activityCounter] = Activity({
            activityId: activityCounter,
            patient: _patient,
            actor: _actor,
            activityType: _activityType,
            description: _description,
            timestamp: block.timestamp,
            relatedCaseId: _relatedCaseId,
            relatedRecordId: _relatedRecordId,
            isVisible: true
        });

        patientActivities[_patient].push(activityCounter);
        
        emit ActivityLogged(activityCounter, _patient, _actor, _activityType);
    }

    function assignDoctor(address _doctor) external onlyAdmin {
        require(!isDoctor[_doctor], "Doctor already assigned");
        isDoctor[_doctor] = true;
        doctorList.push(_doctor);
        emit DoctorAssigned(_doctor);
    }

    function registerPatient(
        string memory _fullName,
        string memory _dob,
        string memory _addressDetails,
        string memory _contactNumber,
        string memory _allergies,
        uint256 _weight,
        uint256 _height,
        uint256 _passcode
    ) external {
        require(
            bytes(patients[msg.sender].fullName).length == 0,
            "Patient already registered"
        );

        patients[msg.sender] = Patient({
            fullName: _fullName,
            dob: _dob,
            addressDetails: _addressDetails,
            contactNumber: _contactNumber,
            allergies: _allergies,
            weight: _weight,
            height: _height,
            caseIds: new uint256[](0),
            passcodeHash: uint256(keccak256(abi.encodePacked(_passcode)))
        });
        
        // Log registration activity
        _logActivity(
            msg.sender,
            msg.sender,
            "patient_registration",
            string(abi.encodePacked("Patient ", _fullName, " registered successfully")),
            0,
            0
        );
        
        emit PatientRegistered(msg.sender, _fullName);
    }

    function verifyPasscode(address _patient, uint256 _passcode) internal view {
        require(
            patients[_patient].passcodeHash ==
                uint256(keccak256(abi.encodePacked(_passcode))),
            "Invalid Passcode"
        );
    }

    function createCase(
        address _patientAddress,
        uint256 _passcode,
        string memory _caseTitle
    ) external onlyDoctor {
        verifyPasscode(_patientAddress, _passcode);

        caseCounter++;
        cases[caseCounter] = MedicalCase({
            caseId: caseCounter,
            patient: _patientAddress,
            isOngoing: true,
            caseTitle: _caseTitle,
            recordIds: new uint256[](0),
            reportCIDs: new string[](0)
        });

        patients[_patientAddress].caseIds.push(caseCounter);
        
        // Log case creation activity
        _logActivity(
            _patientAddress,
            msg.sender,
            "case_created",
            string(abi.encodePacked("New case created: ", _caseTitle)),
            caseCounter,
            0
        );
        
        emit CaseCreated(caseCounter, _patientAddress, _caseTitle);
    }

    function addRecord(
        uint256 _caseId,
        uint256 _passcode,
        string memory _symptoms,
        string memory _cause,
        string memory _inference,
        string memory _prescription,
        string memory _advices,
        string memory _medications
    ) external onlyDoctor {
        verifyPasscode(cases[_caseId].patient, _passcode);
        require(cases[_caseId].isOngoing, "Case is not ongoing");

        recordCounter++;
        records[recordCounter] = MedicalRecord({
            recordId: recordCounter,
            caseId: _caseId,
            doctor: msg.sender,
            symptoms: _symptoms,
            cause: _cause,
            inference: _inference,
            prescription: _prescription,
            advices: _advices,
            medications: _medications
        });

        cases[_caseId].recordIds.push(recordCounter);
        
        // Log record addition activity
        _logActivity(
            cases[_caseId].patient,
            msg.sender,
            "record_added",
            "New medical record added to case",
            _caseId,
            recordCounter
        );
        
        emit RecordAdded(recordCounter, _caseId, msg.sender);
    }

    function addReport(
        uint256 _caseId,
        uint256 _passcode,
        string memory _cid
    ) external onlyDoctor {
        verifyPasscode(cases[_caseId].patient, _passcode);
        require(cases[_caseId].isOngoing, "Case is not ongoing");

        cases[_caseId].reportCIDs.push(_cid);
        
        // Log report addition activity
        _logActivity(
            cases[_caseId].patient,
            msg.sender,
            "report_added",
            "New medical report uploaded to case",
            _caseId,
            0
        );
        
        emit ReportAdded(_caseId, _cid);
    }

    function closeCase(uint256 _caseId, uint256 _passcode) external onlyDoctor {
        verifyPasscode(cases[_caseId].patient, _passcode);
        require(cases[_caseId].isOngoing, "Case is not ongoing");

        cases[_caseId].isOngoing = false;
        
        // Log case closure activity
        _logActivity(
            cases[_caseId].patient,
            msg.sender,
            "case_closed",
            string(abi.encodePacked("Case closed: ", cases[_caseId].caseTitle)),
            _caseId,
            0
        );
        
        emit CaseClosed(_caseId);
    }

    // New function to update prescription (tracks prescription updates)
    function updatePrescription(
        uint256 _recordId,
        uint256 _passcode,
        string memory _newPrescription,
        string memory _newMedications
    ) external onlyDoctor {
        require(records[_recordId].doctor == msg.sender, "Not authorized to update this record");
        
        uint256 caseId = records[_recordId].caseId;
        verifyPasscode(cases[caseId].patient, _passcode);
        require(cases[caseId].isOngoing, "Case is not ongoing");

        records[_recordId].prescription = _newPrescription;
        records[_recordId].medications = _newMedications;
        
        // Log prescription update activity
        _logActivity(
            cases[caseId].patient,
            msg.sender,
            "prescription_updated",
            "Prescription and medications updated",
            caseId,
            _recordId
        );
        
        emit PrescriptionUpdated(cases[caseId].patient, msg.sender, _recordId);
    }

    // New function to mark appointment as completed
    function markAppointmentCompleted(
        uint256 _caseId,
        uint256 _passcode,
        string memory _appointmentNotes
    ) external onlyDoctor {
        verifyPasscode(cases[_caseId].patient, _passcode);
        require(cases[_caseId].isOngoing, "Case is not ongoing");
        
        // Log appointment completion activity
        _logActivity(
            cases[_caseId].patient,
            msg.sender,
            "appointment_completed",
            string(abi.encodePacked("Appointment completed - ", _appointmentNotes)),
            _caseId,
            0
        );
    }

    // Function to track record access
    function accessPatientRecords(
        uint256 _caseId,
        uint256 _passcode
    ) external onlyDoctor {
        verifyPasscode(cases[_caseId].patient, _passcode);
        
        lastAccessTime[msg.sender] = block.timestamp;
        
        // Log record access activity
        _logActivity(
            cases[_caseId].patient,
            msg.sender,
            "records_accessed",
            "Medical records accessed by doctor",
            _caseId,
            0
        );
        
        emit RecordsAccessed(cases[_caseId].patient, msg.sender, _caseId);
    }

    // Get recent activities for a patient
    function getRecentActivities(
        uint256 _limit
    ) external view onlyPatient returns (Activity[] memory) {
        uint256[] memory activityIds = patientActivities[msg.sender];
        uint256 totalActivities = activityIds.length;
        
        // Determine how many activities to return
        uint256 activitiesToReturn = totalActivities > _limit ? _limit : totalActivities;
        Activity[] memory recentActivities = new Activity[](activitiesToReturn);
        
        // Get the most recent activities (from the end of the array)
        for (uint256 i = 0; i < activitiesToReturn; i++) {
            uint256 activityIndex = totalActivities - 1 - i; // Start from the most recent
            uint256 activityId = activityIds[activityIndex];
            recentActivities[i] = activities[activityId];
        }
        
        return recentActivities;
    }

    // Get all activities for a patient (with pagination support)
    function getPatientActivities(
        uint256 _offset,
        uint256 _limit
    ) external view onlyPatient returns (Activity[] memory, uint256) {
        uint256[] memory activityIds = patientActivities[msg.sender];
        uint256 totalActivities = activityIds.length;
        
        if (_offset >= totalActivities) {
            return (new Activity[](0), totalActivities);
        }
        
        uint256 remaining = totalActivities - _offset;
        uint256 activitiesToReturn = remaining > _limit ? _limit : remaining;
        Activity[] memory patientActivitiesArray = new Activity[](activitiesToReturn);
        
        // Return activities in reverse chronological order (most recent first)
        for (uint256 i = 0; i < activitiesToReturn; i++) {
            uint256 activityIndex = totalActivities - 1 - _offset - i;
            uint256 activityId = activityIds[activityIndex];
            patientActivitiesArray[i] = activities[activityId];
        }
        
        return (patientActivitiesArray, totalActivities);
    }

    // Doctor can view activities for a specific patient (with passcode verification)
    function getPatientActivitiesForDoctor(
        address _patientAddress,
        uint256 _passcode,
        uint256 _limit
    ) external view onlyDoctor returns (Activity[] memory) {
        verifyPasscode(_patientAddress, _passcode);
        
        uint256[] memory activityIds = patientActivities[_patientAddress];
        uint256 totalActivities = activityIds.length;
        
        uint256 activitiesToReturn = totalActivities > _limit ? _limit : totalActivities;
        Activity[] memory recentActivities = new Activity[](activitiesToReturn);
        
        for (uint256 i = 0; i < activitiesToReturn; i++) {
            uint256 activityIndex = totalActivities - 1 - i;
            uint256 activityId = activityIds[activityIndex];
            recentActivities[i] = activities[activityId];
        }
        
        return recentActivities;
    }

    // Function to get formatted timestamp
    function getActivityTimestamp(uint256 _activityId) external view returns (uint256) {
        return activities[_activityId].timestamp;
    }

    // Function to hide/show activity (privacy control)
    function toggleActivityVisibility(uint256 _activityId) external onlyPatient {
        require(activities[_activityId].patient == msg.sender, "Not your activity");
        activities[_activityId].isVisible = !activities[_activityId].isVisible;
    }

    // All existing functions remain unchanged
    function getRole(address _user) external view returns (string memory) {
        if (isAdmin[_user]) return "Admin";
        if (isDoctor[_user]) return "Doctor";
        if (bytes(patients[_user].fullName).length > 0) return "Patient";
        return "None";
    }

    function getAllDoctors() external view returns (address[] memory) {
        return doctorList;
    }

    function getMyCases()
        external
        view
        onlyPatient
        returns (uint256[] memory, string[] memory)
    {
        uint256[] memory caseIds = patients[msg.sender].caseIds;
        string[] memory caseTitles = new string[](caseIds.length);

        for (uint256 i = 0; i < caseIds.length; i++) {
            caseTitles[i] = cases[caseIds[i]].caseTitle;
        }

        return (caseIds, caseTitles);
    }

    function getCaseDetails(
        uint256 _caseId
    )
        public
        view
        returns (
            uint256,
            address,
            bool,
            string memory,
            uint256[] memory,
            string[] memory
        )
    {
        MedicalCase storage medCase = cases[_caseId];
        return (
            medCase.caseId,
            medCase.patient,
            medCase.isOngoing,
            medCase.caseTitle,
            medCase.recordIds,
            medCase.reportCIDs
        );
    }

    function getMyCaseDetails(
        uint256 _caseId
    ) external view onlyPatient returns (MedicalCase memory) {
        require(
            cases[_caseId].patient == msg.sender,
            "This case does not belong to you"
        );
        return cases[_caseId];
    }

    function getMyCaseRecords(
        uint256 _caseId
    ) external view onlyPatient returns (MedicalRecord[] memory) {
        require(
            cases[_caseId].patient == msg.sender,
            "This case does not belong to you"
        );

        uint256[] memory recordIds = cases[_caseId].recordIds;
        MedicalRecord[] memory recordsArray = new MedicalRecord[](
            recordIds.length
        );

        for (uint256 i = 0; i < recordIds.length; i++) {
            recordsArray[i] = records[recordIds[i]];
        }

        return recordsArray;
    }

    function getMyCaseReports(
        uint256 _caseId
    ) external view onlyPatient returns (string[] memory) {
        require(
            cases[_caseId].patient == msg.sender,
            "This case does not belong to you"
        );
        return cases[_caseId].reportCIDs;
    }

    function getCaseIdsForPatient(
        address _patientAddress
    ) public view returns (uint256[] memory) {
        return patients[_patientAddress].caseIds;
    }

    function verifyPatientAccess(
        address _patientAddress,
        uint256 _passcode
    ) public view returns (bool) {
        return
            (msg.sender == _patientAddress) ||
            (patients[_patientAddress].passcodeHash ==
                uint256(keccak256(abi.encodePacked(_passcode))));
    }

    function getPatientDetailsWithPasscode(
        address _patientAddress,
        uint256 _passcode
    )
        public
        view
        returns (
            string memory fullName,
            string memory dob,
            string memory addressDetails,
            string memory contactNumber,
            string memory allergies,
            uint256 weight,
            uint256 height
        )
    {
        require(
            verifyPatientAccess(_patientAddress, _passcode),
            "Access denied: Invalid passcode"
        );

        Patient storage patient = patients[_patientAddress];
        return (
            patient.fullName,
            patient.dob,
            patient.addressDetails,
            patient.contactNumber,
            patient.allergies,
            patient.weight,
            patient.height
        );
    }
}