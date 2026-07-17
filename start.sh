#!/bin/bash
# start.sh - Launch Unity for the AntiGravityRacing project

# Get the absolute path to the directory containing this script
PROJECT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================="
echo " Starting Unity Editor for AntiGravityRacing      "
echo "=================================================="
echo "Project Path: $PROJECT_PATH"

# Check if Unity Hub is installed on macOS
if [ -d "/Applications/Unity Hub.app" ]; then
    echo "Launching Unity Hub..."
    open -a "Unity Hub"
    echo "NOTE: Because Unity requires specific editor versions to match the project, it is best launched via Unity Hub."
    echo "If the project doesn't open automatically, click 'Add project' in Unity Hub and select the directory above."
else
    # Attempt to open Unity directly if Hub isn't found
    echo "Attempting to launch Unity directly..."
    open -a "Unity" --args -projectPath "$PROJECT_PATH" || echo "Failed to launch Unity automatically. Please open Unity and select the project manually."
fi
