# Standalone AI Agent Demo Runner

This directory contains a standalone terminal-based execution environment for the AI Disaster Response Pipeline.

It is designed to run completely offline from the frontend and database, demonstrating the AI agent's decision-making logic directly.

## Usage

From the `ai-service` directory, run:

```bash
python -m demo.demo_runner
```

This will launch an interactive menu. You can also run directly with flags:

```bash
python -m demo.demo_runner --all       # Run all 25 scenarios
python -m demo.demo_runner --case 1    # Run a specific scenario ID
python -m demo.demo_runner --judge     # Run the curated 6-8 strongest scenarios for judging
python -m demo.demo_runner --safety    # Run only hallucination, conflict, and safety tests
python -m demo.demo_runner --data      # Show available offline data sources
```

## Scenario Philosophy
The scenarios test the system's ability to **coordinate responses** to rapidly changing information, not just predict disasters. It tests the 6 specialized agents: Situation, Risk, Predictive, Resource, Route, and the Master Coordinator.

The scenarios actively inject edge cases such as fake hospitals, fake routing coordinates, blocked roads, full hospitals, and offline/stale data to verify that the **Safety and Autonomy layers** accurately downgrade confidence and require human approval, proving that the system is safe for deployment as a recommender system.
