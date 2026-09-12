import React from 'react';
import { Card, Panel } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { Label, Input, Select } from '../components/ui/Form';
import { Alert } from '../components/ui/Alert';

export default function Resources() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 lg:p-6">
      <header>
        <h1 className="text-3xl font-bold">Design System Sandbox</h1>
        <p className="mt-2 text-on-surface-variant">Visual testing ground for the Rakshak design primitives.</p>
      </header>

      {/* Alerts */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Alerts & Notifications</h2>
        <Alert variant="info" title="Information">This is an informational alert.</Alert>
        <Alert variant="warning" title="Warning">A high priority incident was just reported.</Alert>
        <Alert variant="error" title="Critical Failure">Unable to connect to the mesh gateway.</Alert>
        <Alert variant="success" title="Resolved">The dispatch plan was successfully executed.</Alert>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Buttons & Forms */}
        <Panel title="Interactive Elements">
          <div className="space-y-6">
            <div>
              <Label>Button Variants</Label>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost Button</Button>
                <Button variant="danger">Danger</Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="demo-input">Standard Input</Label>
              <Input id="demo-input" placeholder="Enter resource name..." />
              
              <Label htmlFor="demo-error">Error State Input</Label>
              <Input id="demo-error" defaultValue="Invalid data" error="This field is required." />

              <Label htmlFor="demo-select">Standard Select</Label>
              <Select id="demo-select">
                <option>Medical Supplies</option>
                <option>Rescue Vehicles</option>
                <option>Personnel</option>
              </Select>
            </div>
          </div>
        </Panel>

        {/* Badges & Indicators */}
        <Card>
          <h3 className="mb-4 text-lg font-bold">Badges & Indicators</h3>
          
          <div className="mb-4 space-y-2">
            <Label>Priorities</Label>
            <div className="flex flex-wrap gap-2">
              {['P5', 'P4', 'P3', 'P2', 'P1'].map(p => (
                <PriorityBadge key={p} level={p} />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Statuses</Label>
            <div className="flex flex-wrap gap-2">
              {['NEW', 'ANALYZING', 'ASSIGNED', 'APPROVED', 'DISPATCHED', 'EN_ROUTE', 'RESOLVED', 'REJECTED'].map(s => (
                <StatusBadge key={s} status={s} />
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Tables */}
      <Panel title="Data Density (Tables)" action={<Button variant="secondary">Export CSV</Button>}>
        <Table>
          <TableHead>
            <TableRow hover={false}>
              <TableCell isHeader>Resource ID</TableCell>
              <TableCell isHeader>Priority</TableCell>
              <TableCell isHeader>Status</TableCell>
              <TableCell isHeader>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono font-bold">RSC-0921</TableCell>
              <TableCell><PriorityBadge level="P5" /></TableCell>
              <TableCell><StatusBadge status="EN_ROUTE" /></TableCell>
              <TableCell><Button variant="ghost">View Details</Button></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono font-bold">RSC-0922</TableCell>
              <TableCell><PriorityBadge level="P3" /></TableCell>
              <TableCell><StatusBadge status="ASSIGNED" /></TableCell>
              <TableCell><Button variant="ghost">View Details</Button></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono font-bold">RSC-0923</TableCell>
              <TableCell><PriorityBadge level="P1" /></TableCell>
              <TableCell><StatusBadge status="RESOLVED" /></TableCell>
              <TableCell><Button variant="ghost">View Details</Button></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
