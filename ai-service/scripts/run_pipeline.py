import os
import subprocess
import sys

def run_script(script_name):
    print(f"\n{'='*50}")
    print(f"Executing: {script_name}")
    print(f"{'='*50}")
    result = subprocess.run([sys.executable, script_name], capture_output=False)
    if result.returncode != 0:
        print(f"Error executing {script_name}. Pipeline stopped.")
        sys.exit(result.returncode)

def main():
    print("Starting Data Pipeline...")
    scripts_dir = "scripts"
    
    pipeline = [
        "download_data.py",
        "extract_data.py",
        "clean_data.py",
        "preprocess_data.py",
        "build_training_dataset.py",
        "validate_data.py"
    ]
    
    for script in pipeline:
        script_path = os.path.join(scripts_dir, script)
        if os.path.exists(script_path):
            run_script(script_path)
        else:
            print(f"Script {script_path} not found!")
            sys.exit(1)
            
    print("\n" + "="*50)
    print("PIPELINE COMPLETED SUCCESSFULLY")
    print("="*50)

if __name__ == "__main__":
    main()
