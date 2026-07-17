using UnityEngine;

#if UNITY_EDITOR
using UnityEditor;
#endif

namespace AntiGravityRacing.Data
{
    /// <summary>
    /// A ScriptableObject that defines the core statistics and assets for a specific anti-gravity vehicle.
    /// It acts as a data-driven blueprint for both gameplay physics and UI representation.
    /// </summary>
    [CreateAssetMenu(fileName = "NewVehicleData", menuName = "Anti-Gravity Racing/Vehicle Data")]
    public class VehicleData : ScriptableObject
    {
        [Header("General Info")]
        [Tooltip("The display name of the vehicle.")]
        public string vehicleName = "New Ship";
        
        [Tooltip("The 3D model prefab instantiated into the world for this vehicle.")]
        public GameObject prefab;
        
        [Tooltip("2D Icon used in UI menus (e.g., character select).")]
        public Sprite icon;
        
        [TextArea(3, 5)]
        [Tooltip("Lore or flavor text describing the vehicle's characteristics.")]
        public string description;

        [Header("Physics Modifiers (0.0 to 1.0)")]
        [Tooltip("Maximum forward speed capability.")]
        [Range(0f, 1f)]
        public float topSpeed = 0.5f;

        [Tooltip("How quickly the ship reaches its top speed.")]
        [Range(0f, 1f)]
        public float accelerationRate = 0.5f;

        [Tooltip("Torque handling sensitivity; how sharply the vehicle can turn.")]
        [Range(0f, 1f)]
        public float handlingSensitivity = 0.5f;

        [Tooltip("The target resting hover height above the track surface.")]
        [Range(0f, 1f)]
        public float hoverHeight = 0.5f;

        [Tooltip("Maximum energy/shield capacity before destruction.")]
        [Range(0f, 1f)]
        public float shieldCapacity = 0.5f;

        /// <summary>
        /// Validation method called when values are modified in the Inspector.
        /// Ensures all stats remain strictly normalized between 0.0 and 1.0 for UI bars and physics multipliers.
        /// </summary>
        private void OnValidate()
        {
            topSpeed = Mathf.Clamp01(topSpeed);
            accelerationRate = Mathf.Clamp01(accelerationRate);
            handlingSensitivity = Mathf.Clamp01(handlingSensitivity);
            hoverHeight = Mathf.Clamp01(hoverHeight);
            shieldCapacity = Mathf.Clamp01(shieldCapacity);
        }
    }
}
