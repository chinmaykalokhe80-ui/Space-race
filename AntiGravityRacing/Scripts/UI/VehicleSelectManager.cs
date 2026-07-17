using UnityEngine;
using UnityEngine.UI;
using TMPro; // TextMeshPro used for modern UI

namespace AntiGravityRacing.UI
{
    /// <summary>
    /// Manages the UI state and 3D preview of the vehicle selection screen.
    /// </summary>
    public class VehicleSelectManager : MonoBehaviour
    {
        [Header("Data References")]
        [Tooltip("List of all available vehicle blueprints to select from.")]
        [SerializeField] private Data.VehicleData[] availableVehicles;

        [Header("3D Preview Settings")]
        [Tooltip("The transform where the selected 3D vehicle prefab will be spawned.")]
        [SerializeField] private Transform previewPedestal;
        
        [Tooltip("How fast the 3D preview model rotates along the Y-axis.")]
        [SerializeField] private float rotationSpeed = 30f;

        [Header("UI Bindings")]
        [SerializeField] private TextMeshProUGUI nameText;
        [SerializeField] private TextMeshProUGUI descriptionText;
        [SerializeField] private Image topSpeedFill;
        [SerializeField] private Image accelerationFill;
        [SerializeField] private Image handlingFill;
        [SerializeField] private Image shieldFill;

        private int _currentIndex = 0;
        private GameObject _currentPreviewInstance;

        private void Start()
        {
            if (availableVehicles == null || availableVehicles.Length == 0)
            {
                Debug.LogWarning("VehicleSelectManager: No VehicleData assigned in the inspector.");
                return;
            }

            // Initialize the first vehicle
            SelectVehicle(0);
        }

        private void Update()
        {
            // Smoothly rotate the preview model over time
            if (_currentPreviewInstance != null)
            {
                _currentPreviewInstance.transform.Rotate(Vector3.up, rotationSpeed * Time.deltaTime, Space.World);
            }
        }

        /// <summary>
        /// Selects a new vehicle, updates the 3D preview, and populates the UI.
        /// </summary>
        /// <param name="index">The array index of the vehicle to select.</param>
        public void SelectVehicle(int index)
        {
            if (index < 0 || index >= availableVehicles.Length)
                return;

            _currentIndex = index;
            Data.VehicleData selectedData = availableVehicles[_currentIndex];

            Update3DPreview(selectedData);
            UpdateUI(selectedData);
        }

        /// <summary>
        /// Cycles to the next vehicle in the roster.
        /// </summary>
        public void NextVehicle()
        {
            int nextIndex = (_currentIndex + 1) % availableVehicles.Length;
            SelectVehicle(nextIndex);
        }

        /// <summary>
        /// Cycles to the previous vehicle in the roster.
        /// </summary>
        public void PreviousVehicle()
        {
            int prevIndex = (_currentIndex - 1 + availableVehicles.Length) % availableVehicles.Length;
            SelectVehicle(prevIndex);
        }

        /// <summary>
        /// Instantiates the preview model on the pedestal, destroying any existing preview.
        /// </summary>
        private void Update3DPreview(Data.VehicleData data)
        {
            // Clean up the old preview if it exists
            if (_currentPreviewInstance != null)
            {
                Destroy(_currentPreviewInstance);
            }

            if (data.prefab != null && previewPedestal != null)
            {
                // Instantiate the new preview model at the pedestal's location and rotation
                _currentPreviewInstance = Instantiate(data.prefab, previewPedestal.position, previewPedestal.rotation, previewPedestal);
                
                // Strip out physics or gameplay scripts that shouldn't run on the menu screen
                // if (_currentPreviewInstance.TryGetComponent(out Physics.AntiGravityController controller))
                // {
                //     Destroy(controller);
                // }
            }
        }

        /// <summary>
        /// Updates the UI text and stat bars based on the selected vehicle data.
        /// </summary>
        private void UpdateUI(Data.VehicleData data)
        {
            if (nameText != null) nameText.text = data.vehicleName;
            if (descriptionText != null) descriptionText.text = data.description;

            // Fill amounts directly use the 0 to 1 normalized data structure
            if (topSpeedFill != null) topSpeedFill.fillAmount = data.topSpeed;
            if (accelerationFill != null) accelerationFill.fillAmount = data.accelerationRate;
            if (handlingFill != null) handlingFill.fillAmount = data.handlingSensitivity;
            if (shieldFill != null) shieldFill.fillAmount = data.shieldCapacity;
        }

        /// <summary>
        /// Confirms the current selection, saving it persistently, and handles transition logic.
        /// </summary>
        public void ConfirmSelection()
        {
            if (availableVehicles.Length == 0) return;

            string selectedVehicleName = availableVehicles[_currentIndex].name; // Using ScriptableObject Asset name
            
            // Save to PlayerPrefs for simple persistent hand-off to gameplay scene
            PlayerPrefs.SetString("SelectedVehicleID", selectedVehicleName);
            PlayerPrefs.Save();

            Debug.Log($"Vehicle '{selectedVehicleName}' selected and saved! Transitioning to race scene...");
            
            // Transition logic goes here
            // e.g., UnityEngine.SceneManagement.SceneManager.LoadScene("RaceTrack01");
        }
    }
}
