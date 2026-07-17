#!/bin/bash
# stop.sh - Terminate the Unity Editor

echo "=================================================="
echo " Stopping Unity Editor                            "
echo "=================================================="

# Use pkill to terminate running Unity Editor processes
if pkill -f "Unity"; then
    echo "Unity Editor processes have been successfully terminated."
else
    echo "No running Unity Editor processes found."
fi
