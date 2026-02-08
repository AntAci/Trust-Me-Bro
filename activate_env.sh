#!/bin/bash
# Activation script for trustmebro conda environment
# Usage: source activate_env.sh

# Initialize conda
eval "$(conda shell.bash hook)"

# Activate the environment
conda activate trustmebro

# Verify activation
echo "Activated conda environment: trustmebro"
python --version
which python
