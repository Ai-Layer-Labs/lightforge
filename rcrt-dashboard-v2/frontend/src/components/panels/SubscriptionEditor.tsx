import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  BoltIcon,
  BookOpenIcon,
  TagIcon,
  AdjustmentsHorizontalIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface Subscription {
  comment?: string;
  schema_name?: string;
  any_tags?: string[];
  all_tags?: string[];
  context_match?: Array<{
    path: string;
    op: string;
    value: any;
  }>;
  role?: 'trigger' | 'context';
  key?: string;
  fetch?: {
    method: 'event_data' | 'latest' | 'recent' | 'vector';
    limit?: number;
  };
}

interface SubscriptionEditorProps {
  subscriptions: Subscription[];
  onChange: (subscriptions: Subscription[]) => void;
}

export function SubscriptionEditor({ subscriptions, onChange }: SubscriptionEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<Subscription>({});
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = () => {
    setEditingData({
      role: 'context',
      fetch: { method: 'recent', limit: 10 }
    });
    setShowAddForm(true);
  };

  const handleSaveNew = () => {
    onChange([...subscriptions, editingData]);
    setShowAddForm(false);
    setEditingData({});
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditingData({ ...subscriptions[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const updated = [...subscriptions];
    updated[editingIndex] = editingData;
    onChange(updated);
    setEditingIndex(null);
    setEditingData({});
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setShowAddForm(false);
    setEditingData({});
  };

  const handleDelete = (index: number) => {
    const updated = subscriptions.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateEditingField = (field: string, value: any) => {
    setEditingData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = (field: 'any_tags' | 'all_tags', tag: string) => {
    if (!tag.trim()) return;
    const current = editingData[field] || [];
    if (!current.includes(tag)) {
      updateEditingField(field, [...current, tag]);
    }
  };

  const removeTag = (field: 'any_tags' | 'all_tags', tag: string) => {
    const current = editingData[field] || [];
    updateEditingField(field, current.filter(t => t !== tag));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <AdjustmentsHorizontalIcon className="w-4 h-4" />
          Subscriptions ({subscriptions.length})
        </label>
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 flex items-center gap-1"
        >
          <PlusIcon className="w-4 h-4" />
          Add
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {/* Existing Subscriptions */}
        {subscriptions.map((sub, idx) => (
          <div key={idx}>
            {editingIndex === idx ? (
              <SubscriptionForm
                data={editingData}
                onUpdate={updateEditingField}
                onSave={handleSaveEdit}
                onCancel={handleCancel}
                addTag={addTag}
                removeTag={removeTag}
              />
            ) : (
              <SubscriptionCard
                subscription={sub}
                index={idx}
                onEdit={() => handleEdit(idx)}
                onDelete={() => handleDelete(idx)}
              />
            )}
          </div>
        ))}

        {/* Add New Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <SubscriptionForm
                data={editingData}
                onUpdate={updateEditingField}
                onSave={handleSaveNew}
                onCancel={handleCancel}
                addTag={addTag}
                removeTag={removeTag}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="text-xs text-gray-500 mt-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded">
        <InformationCircleIcon className="w-4 h-4 inline mr-1" />
        <strong>Trigger</strong> subscriptions activate the agent. 
        <strong className="ml-2">Context</strong> subscriptions provide data when triggered.
      </div>
    </div>
  );
}

function SubscriptionCard({ subscription, index, onEdit, onDelete }: {
  subscription: Subscription;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const roleColor = subscription.role === 'trigger' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300';
  const roleIcon = subscription.role === 'trigger' ? <BoltIcon className="w-3 h-3" /> : <BookOpenIcon className="w-3 h-3" />;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-gray-800/70 border border-gray-700 rounded-lg p-3 hover:border-blue-500/50 transition-all group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {subscription.comment && (
            <div className="text-xs text-gray-400 mb-2 italic">
              {subscription.comment}
            </div>
          )}
          
          <div className="flex flex-wrap gap-1.5 mb-2">
            {subscription.role && (
              <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${roleColor}`}>
                {roleIcon}
                {subscription.role}
              </span>
            )}
            
            {subscription.schema_name && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
                schema: {subscription.schema_name}
              </span>
            )}
            
            {subscription.key && (
              <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
                key: {subscription.key}
              </span>
            )}
          </div>
          
          {subscription.any_tags && subscription.any_tags.length > 0 && (
            <div className="text-xs text-gray-400 mb-1">
              <TagIcon className="w-3 h-3 inline mr-1" />
              Any: {subscription.any_tags.join(', ')}
            </div>
          )}
          
          {subscription.all_tags && subscription.all_tags.length > 0 && (
            <div className="text-xs text-gray-400 mb-1">
              <TagIcon className="w-3 h-3 inline mr-1" />
              All: {subscription.all_tags.join(', ')}
            </div>
          )}
          
          {subscription.fetch && (
            <div className="text-xs text-gray-500">
              Fetch: {subscription.fetch.method}
              {subscription.fetch.limit && ` (limit: ${subscription.fetch.limit})`}
            </div>
          )}
        </div>
        
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 bg-blue-600/20 text-blue-300 rounded hover:bg-blue-600/30"
            title="Edit"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 bg-red-600/20 text-red-300 rounded hover:bg-red-600/30"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SubscriptionForm({ data, onUpdate, onSave, onCancel, addTag, removeTag }: {
  data: Subscription;
  onUpdate: (field: string, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
  addTag: (field: 'any_tags' | 'all_tags', tag: string) => void;
  removeTag: (field: 'any_tags' | 'all_tags', tag: string) => void;
}) {
  const [newTag, setNewTag] = useState('');
  const [tagField, setTagField] = useState<'any_tags' | 'all_tags'>('any_tags');

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 border border-blue-500/50 rounded-lg p-4 space-y-3"
    >
      {/* Comment */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Description</label>
        <input
          type="text"
          value={data.comment || ''}
          onChange={(e) => onUpdate('comment', e.target.value)}
          placeholder="What does this subscription do?"
          className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Role */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Role</label>
          <select
            value={data.role || 'context'}
            onChange={(e) => onUpdate('role', e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="trigger">Trigger (activates agent)</option>
            <option value="context">Context (provides data)</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Key</label>
          <input
            type="text"
            value={data.key || ''}
            onChange={(e) => onUpdate('key', e.target.value)}
            placeholder="variable_name"
            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:border-blue-500 focus:outline-none font-mono"
          />
        </div>
      </div>

      {/* Schema */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Schema Name</label>
        <input
          type="text"
          value={data.schema_name || ''}
          onChange={(e) => onUpdate('schema_name', e.target.value)}
          placeholder="user.message.v1"
          className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:border-blue-500 focus:outline-none font-mono"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Tags</label>
        <div className="flex gap-2 mb-2">
          <select
            value={tagField}
            onChange={(e) => setTagField(e.target.value as any)}
            className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-xs focus:border-blue-500 focus:outline-none"
          >
            <option value="any_tags">Any Tags (OR)</option>
            <option value="all_tags">All Tags (AND)</option>
          </select>
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addTag(tagField, newTag);
                setNewTag('');
              }
            }}
            placeholder="tag-name"
            className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-xs focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => {
              addTag(tagField, newTag);
              setNewTag('');
            }}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-500"
          >
            Add
          </button>
        </div>

        {/* Any Tags */}
        {data.any_tags && data.any_tags.length > 0 && (
          <div className="mb-2">
            <div className="text-xs text-gray-500 mb-1">Any Tags (OR):</div>
            <div className="flex flex-wrap gap-1">
              {data.any_tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs flex items-center gap-1"
                >
                  {tag}
                  <button
                    onClick={() => removeTag('any_tags', tag)}
                    className="hover:text-red-400"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* All Tags */}
        {data.all_tags && data.all_tags.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">All Tags (AND):</div>
            <div className="flex flex-wrap gap-1">
              {data.all_tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs flex items-center gap-1"
                >
                  {tag}
                  <button
                    onClick={() => removeTag('all_tags', tag)}
                    className="hover:text-red-400"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fetch Method */}
      {data.role === 'context' && (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Fetch Method</label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={data.fetch?.method || 'recent'}
              onChange={(e) => onUpdate('fetch', { ...data.fetch, method: e.target.value })}
              className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="event_data">Event Data</option>
              <option value="latest">Latest</option>
              <option value="recent">Recent</option>
              <option value="vector">Vector Search</option>
            </select>

            {(data.fetch?.method === 'recent' || data.fetch?.method === 'latest' || data.fetch?.method === 'vector') && (
              <input
                type="number"
                value={data.fetch?.limit || 10}
                onChange={(e) => onUpdate('fetch', { ...data.fetch, limit: parseInt(e.target.value) })}
                placeholder="Limit"
                min="1"
                max="100"
                className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.fetch?.method === 'event_data' && 'Uses data from the triggering event'}
            {data.fetch?.method === 'latest' && 'Fetches most recent breadcrumb'}
            {data.fetch?.method === 'recent' && 'Fetches recent breadcrumbs (chronological)'}
            {data.fetch?.method === 'vector' && 'Semantic search (most relevant)'}
          </div>
        </div>
      )}

      {data.role === 'trigger' && (
        <div className="text-xs text-blue-400 p-2 bg-blue-500/10 rounded">
          <BoltIcon className="w-4 h-4 inline mr-1" />
          Trigger subscriptions activate the agent when matching events occur
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-gray-700">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm flex items-center justify-center gap-1"
        >
          <XMarkIcon className="w-4 h-4" />
          Cancel
        </button>
        <button
          onClick={onSave}
          className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-500 text-sm flex items-center justify-center gap-1"
        >
          <CheckIcon className="w-4 h-4" />
          Save
        </button>
      </div>
    </motion.div>
  );
}

export default SubscriptionEditor;
