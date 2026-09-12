import React from 'react'

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 shadow">
        <h1 className="text-xl font-bold">AI Disaster Response Coordination</h1>
      </header>
      <main className="p-6">
        <p className="text-gray-700">Frontend shell initialized. Implement the dashboard components here.</p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 shadow rounded">Citizen SOS Placeholder</div>
          <div className="bg-white p-4 shadow rounded">Operator Dashboard Placeholder</div>
          <div className="bg-white p-4 shadow rounded">Simulation Panel Placeholder</div>
          <div className="bg-white p-4 shadow rounded">AI Response Plan Placeholder</div>
        </div>
      </main>
    </div>
  )
}

export default App
