using UnityEngine;
using UnityEngine.InputSystem; // Requires Unity's New Input System
using AntiGravityRacing.Data;

namespace AntiGravityRacing.Physics
{
    /// <summary>
    /// Core Rigidbody-based physics controller for anti-gravity vehicles.
    /// Handles multi-point suspension, surface normal alignment, thrust, and drifting.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public class AntiGravityController : MonoBehaviour
    {
        [Header("Vehicle Configuration")]
        [Tooltip("The blueprint defining this vehicle's physics multipliers.")]
        [SerializeField] private VehicleData vehicleData;
        
        [Header("Hover Suspension Settings")]
        [Tooltip("The 4 corner points where downward raycasts are emitted for hover physics.")]
        [SerializeField] private Transform[] hoverPoints;
        
        [Tooltip("Layer mask representing the track surface.")]
        [SerializeField] private LayerMask trackLayerMask;
        
        [Tooltip("Base distance the raycast checks for a surface.")]
        [SerializeField] private float hoverRaycastDistance = 3f;
        
        [Tooltip("Spring constant (k) for Hooke's Law. Higher means a stiffer suspension.")]
        [SerializeField] private float suspensionSpringStrength = 5000f;
        
        [Tooltip("Damping factor (c) to prevent infinite oscillation.")]
        [SerializeField] private float suspensionDamping = 500f;

        [Header("Movement Settings")]
        [Tooltip("Base maximum speed before multipliers.")]
        [SerializeField] private float baseTopSpeed = 100f;
        
        [Tooltip("Base forward force applied for acceleration.")]
        [SerializeField] private float baseAccelerationForce = 5000f;
        
        [Tooltip("Base torque force for turning.")]
        [SerializeField] private float baseTurnTorque = 3000f;

        [Header("Alignment & Drifting")]
        [Tooltip("How quickly the ship's upward axis interpolates to match the ground normal.")]
        [SerializeField] private float normalAlignmentSpeed = 5f;
        
        [Tooltip("Friction applied to lateral (sideways) velocity to keep the ship from sliding.")]
        [SerializeField] private float gripFriction = 10f;
        
        [Tooltip("Reduced lateral friction when sliding/drifting.")]
        [SerializeField] private float driftFriction = 2f;

        // Component References
        private Rigidbody _rb;

        // Input State
        private Vector2 _moveInput;
        private bool _isDrifting;

        private void Awake()
        {
            if (!TryGetComponent(out _rb))
            {
                Debug.LogError("AntiGravityController requires a Rigidbody component!");
                return;
            }
            
            // Setup rigidbody for smooth physics execution
            _rb.interpolation = RigidbodyInterpolation.Interpolate;
            _rb.useGravity = true; // Gravity still affects the ship, the suspension spring pushes against it
        }

        #region Input Handling (New Input System)
        
        /// <summary>
        /// Callback for steering and acceleration/braking (Vector2).
        /// Example binding: Left Stick or WASD.
        /// </summary>
        public void OnMove(InputAction.CallbackContext context)
        {
            _moveInput = context.ReadValue<Vector2>();
        }

        /// <summary>
        /// Callback for activating the drift/slide modifier.
        /// Example binding: Right Trigger or Spacebar.
        /// </summary>
        public void OnDrift(InputAction.CallbackContext context)
        {
            if (context.started) _isDrifting = true;
            else if (context.canceled) _isDrifting = false;
        }

        #endregion

        private void FixedUpdate()
        {
            if (vehicleData == null || _rb == null) return;

            Vector3 averageNormal = Vector3.up;
            int groundedPoints = 0;

            // 1. Multi-Point Hover Suspension
            foreach (Transform hoverPoint in hoverPoints)
            {
                if (hoverPoint == null) continue;

                // Adjust target hover height using the VehicleData's modifier (0.0 to 1.0 -> practical physics distance)
                float targetHoverHeight = 1.0f + (vehicleData.hoverHeight * 1.5f);
                float rayDistance = Mathf.Max(hoverRaycastDistance, targetHoverHeight * 1.5f);

                // Raycast downwards relative to the ship's local down vector
                if (UnityEngine.Physics.Raycast(hoverPoint.position, -transform.up, out RaycastHit hit, rayDistance, trackLayerMask))
                {
                    // Calculate Hooke's Law: F = k * (target_distance - current_distance) - c * local_velocity
                    float distanceError = targetHoverHeight - hit.distance;
                    
                    // Velocity at this specific suspension point
                    float velocityAlongDownAxis = Vector3.Dot(_rb.GetPointVelocity(hoverPoint.position), -transform.up);
                    
                    float springForce = (distanceError * suspensionSpringStrength) - (velocityAlongDownAxis * suspensionDamping);
                    
                    // Only push up (don't pull down if above target, gravity will naturally bring it back down)
                    if (springForce > 0f)
                    {
                        _rb.AddForceAtPosition(transform.up * springForce, hoverPoint.position, ForceMode.Acceleration);
                    }

                    averageNormal += hit.normal;
                    groundedPoints++;
                }
            }

            // 2. Surface Normal Alignment
            if (groundedPoints > 0)
            {
                averageNormal = (averageNormal / groundedPoints).normalized;
                
                // Determine the target rotation that aligns 'up' with 'averageNormal' while preserving forward facing direction
                Vector3 projectedForward = Vector3.ProjectOnPlane(transform.forward, averageNormal).normalized;
                
                // Prevent Quaternion.LookRotation failure when vectors perfectly align
                if (projectedForward.sqrMagnitude > 0.01f)
                {
                    Quaternion targetRotation = Quaternion.LookRotation(projectedForward, averageNormal);
                    
                    // Smoothly interpolate towards the surface normal
                    _rb.MoveRotation(Quaternion.Slerp(_rb.rotation, targetRotation, Time.fixedDeltaTime * normalAlignmentSpeed));
                }
            }

            // 3. Thrust & Acceleration
            // Map 0-1 data to game feel multipliers (e.g., 0.5x to 1.5x of base value)
            float accelModifier = 0.5f + (vehicleData.accelerationRate * 1.0f); 
            float maxSpeedModifier = 0.5f + (vehicleData.topSpeed * 1.0f);

            float currentForwardSpeed = Vector3.Dot(_rb.velocity, transform.forward);
            float actualMaxSpeed = baseTopSpeed * maxSpeedModifier;

            // Apply thrust if input is forward and under max speed limit
            if (_moveInput.y > 0 && currentForwardSpeed < actualMaxSpeed)
            {
                _rb.AddForce(transform.forward * (_moveInput.y * baseAccelerationForce * accelModifier), ForceMode.Acceleration);
            }
            // Optional: Air-braking or reverse force when input is negative
            else if (_moveInput.y < 0)
            {
                 _rb.AddForce(transform.forward * (_moveInput.y * baseAccelerationForce * accelModifier * 0.7f), ForceMode.Acceleration);
            }

            // 4. Steering & Rotation (Torque)
            float handlingModifier = 0.5f + (vehicleData.handlingSensitivity * 1.5f);
            
            if (Mathf.Abs(_moveInput.x) > 0.01f)
            {
                // Applying torque on the local Y (up) axis to steer
                _rb.AddTorque(transform.up * (_moveInput.x * baseTurnTorque * handlingModifier), ForceMode.Acceleration);
            }

            // 5. Lateral Friction & Drifting System
            // Calculate lateral velocity (sideways sliding movement)
            Vector3 lateralVelocity = transform.right * Vector3.Dot(_rb.velocity, transform.right);
            
            // Select appropriate friction damper depending on if drift is held down
            float currentLateralFriction = _isDrifting ? driftFriction : gripFriction;
            
            // Apply counter-force to dampen sideways sliding and restore grip
            _rb.AddForce(-lateralVelocity * currentLateralFriction, ForceMode.Acceleration);
        }
    }
}
