import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Field } from '../components/ui/Field';
import { StatusChip } from '../components/ui/StatusChip';
import { TickScale } from '../components/ui/TickScale';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { NextStepBanner } from '../components/ui/NextStepBanner';
import { PageHeader } from '../components/ui/PageHeader';
import { DemoBadge } from '../components/ui/DemoBadge';
import { FileDrop } from '../components/ui/FileDrop';

export const Design = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="flex flex-col gap-12 pb-12">
      <PageHeader title="Design System" description="A comprehensive view of all UI components and their states." />

      <section>
        <h2 className="text-xl font-heading font-bold mb-4">Typography & Tokens</h2>
        <div className="flex gap-4 mb-4">
          <DemoBadge />
          <StatusChip status="Draft" />
          <StatusChip status="Submitted" />
          <StatusChip status="Certified" />
          <StatusChip status="Expired" />
          <StatusChip status="Failed" />
        </div>
        <p className="font-sans">Source Sans 3 for UI components.</p>
        <p className="font-mono">JetBrains Mono for ID: NSH-1234</p>
      </section>

      <section>
        <h2 className="text-xl font-heading font-bold mb-4">Buttons</h2>
        <div className="flex gap-4 flex-wrap">
          <Button variant="primary">Primary Action</Button>
          <Button variant="secondary">Secondary Action</Button>
          <Button variant="outline">Outline Action</Button>
          <Button variant="danger">Danger Action</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="max-w-md">
        <h2 className="text-xl font-heading font-bold mb-4">Form Fields</h2>
        <Field label="Standard Input">
          <Input placeholder="Type here..." />
        </Field>
        <Field label="Input with Error" error="This field is required.">
          <Input error defaultValue="Invalid data" />
        </Field>
        <Field label="Select Dropdown">
          <Select>
            <option>Option 1</option>
            <option>Option 2</option>
          </Select>
        </Field>
        <Field label="Text Area">
          <Textarea placeholder="Type notes here..." />
        </Field>
        <Field label="File Drop">
          <FileDrop onFileChange={() => {}} />
        </Field>
      </section>

      <section>
        <h2 className="text-xl font-heading font-bold mb-4">Tick Scale (Progress)</h2>
        <TickScale steps={[
          { label: 'Draft', active: false, completed: true },
          { label: 'Paid', active: false, completed: true },
          { label: 'Inspection', active: true, completed: false },
          { label: 'Certified', active: false, completed: false },
        ]} />
      </section>

      <section>
        <h2 className="text-xl font-heading font-bold mb-4">Data Table</h2>
        <DataTable 
          columns={[{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }, { key: 'status', header: 'Status' }]} 
          data={[
            { id: '1', name: 'Scale A', status: 'Valid' },
            { id: '2', name: 'Weight B', status: 'Expired' }
          ]} 
        />
      </section>

      <section>
        <h2 className="text-xl font-heading font-bold mb-4">States & Feedback</h2>
        <div className="flex flex-col gap-6 max-w-lg">
          <NextStepBanner text="Proceed to the payment gateway to finalize your application." />
          <EmptyState title="No Records Found" description="You haven't submitted any applications yet." action={<Button>Create New</Button>} />
          <ErrorState title="Connection Failed" description="Could not load the requested data." onRetry={() => {}} />
          <div className="p-4 bg-white rounded shadow-sm border border-gray-200">
            <Skeleton className="h-6 w-1/3 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
        </div>
      </section>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Sample Modal">
        <p className="mb-4">This is the content inside the modal dialog.</p>
        <Button onClick={() => setModalOpen(false)}>Close</Button>
      </Modal>

      <Toast message="This is an info toast notification!" type="info" />
    </main>
  );
};
