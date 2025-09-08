/**
 * Agent Management Panel
 * Monitor and manage agents in the system
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Badge,
  Button,
  Modal,
  Input,
  Select,
  Tooltip,
  Chip,
  User,
  Dropdown,
  Checkbox
} from '@heroui/react';
import { useRCRT } from '@rcrt-builder/ui';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface Agent {
  id: string;
  roles: string[];
  created_at: string;
  status?: 'active' | 'inactive' | 'error';
  last_activity?: string;
  metadata?: any;
}

interface AgentPanelProps {
  workspace: string;
  onAgentSelect?: (agent: Agent) => void;
  onLinkToNode?: (agentId: string) => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  workspace,
  onAgentSelect,
  onLinkToNode
}) => {
  const { client, listAgents, createAgent, deleteAgent } = useRCRT({ workspace });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [pollInterval, setPollInterval] = useState(5000);
  
  // New agent form state
  const [newAgentId, setNewAgentId] = useState('');
  const [newAgentRoles, setNewAgentRoles] = useState<string[]>([]);
  
  // Load agents
  const loadAgents = useCallback(async () => {
    try {
      const agentList = await listAgents();
      
      // Enhance with status information
      const enhanced = agentList.map((agent: any) => ({
        ...agent,
        status: determineAgentStatus(agent),
        last_activity: agent.last_activity || agent.created_at
      }));
      
      setAgents(enhanced);
    } catch (error) {
      console.error('Failed to load agents:', error);
      toast.error('Failed to load agents');
    }
  }, [listAgents]);
  
  // Poll for updates
  useEffect(() => {
    loadAgents();
    const interval = setInterval(loadAgents, pollInterval);
    return () => clearInterval(interval);
  }, [loadAgents, pollInterval]);
  
  // Determine agent status
  const determineAgentStatus = (agent: any): 'active' | 'inactive' | 'error' => {
    if (!agent.last_activity) return 'inactive';
    
    const lastActivity = new Date(agent.last_activity);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastActivity.getTime()) / 60000;
    
    if (diffMinutes < 1) return 'active';
    if (diffMinutes < 5) return 'inactive';
    return 'error';
  };
  
  // Handle role update
  const handleRoleUpdate = async (agentId: string, newRoles: string[]) => {
    setIsLoading(true);
    try {
      await createAgent(agentId, newRoles);
      toast.success(`Agent ${agentId} roles updated`);
      await loadAgents();
    } catch (error) {
      console.error('Failed to update agent:', error);
      toast.error('Failed to update agent roles');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle agent deletion
  const handleAgentDelete = async (agentId: string) => {
    if (!confirm(`Delete agent ${agentId}? This cannot be undone.`)) return;
    
    setIsLoading(true);
    try {
      await deleteAgent(agentId);
      toast.success(`Agent ${agentId} deleted`);
      await loadAgents();
    } catch (error) {
      console.error('Failed to delete agent:', error);
      toast.error('Failed to delete agent');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create new agent
  const handleCreateAgent = async () => {
    if (!newAgentId) {
      toast.error('Agent ID is required');
      return;
    }
    
    setIsLoading(true);
    try {
      await createAgent(newAgentId, newAgentRoles);
      toast.success(`Agent ${newAgentId} created`);
      setShowCreateModal(false);
      setNewAgentId('');
      setNewAgentRoles([]);
      await loadAgents();
    } catch (error) {
      console.error('Failed to create agent:', error);
      toast.error('Failed to create agent');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Status badge component
  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const config = {
      active: { color: 'success' as const, text: 'ACTIVE' },
      inactive: { color: 'warning' as const, text: 'IDLE' },
      error: { color: 'danger' as const, text: 'ERROR' }
    };
    
    const { color, text } = config[status as keyof typeof config] || config.inactive;
    
    return (
      <Badge color={color} variant="dot">
        {text}
      </Badge>
    );
  };
  
  // Role badges component
  const RoleBadges: React.FC<{ roles: string[] }> = ({ roles }) => {
    const roleColors: Record<string, any> = {
      emitter: 'success',
      subscriber: 'primary',
      curator: 'danger',
      admin: 'secondary'
    };
    
    return (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {roles.map(role => (
          <Chip
            key={role}
            size="sm"
            color={roleColors[role] || 'default'}
            variant="flat"
          >
            {role}
          </Chip>
        ))}
      </div>
    );
  };
  
  return (
    <>
      <Card className="agent-panel">
        <Card.Header>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            width: '100%'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>Agent Management</h3>
              <Badge color={agents.length > 0 ? 'success' : 'warning'} size="lg">
                {agents.length} {agents.length === 1 ? 'Agent' : 'Agents'}
              </Badge>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Select
                size="sm"
                placeholder="Poll interval"
                value={String(pollInterval)}
                onChange={(e) => setPollInterval(Number(e.target.value))}
                style={{ width: '120px' }}
              >
                <Select.Option value="5000">5s</Select.Option>
                <Select.Option value="10000">10s</Select.Option>
                <Select.Option value="30000">30s</Select.Option>
                <Select.Option value="60000">1m</Select.Option>
              </Select>
              
              <Button
                color="primary"
                size="sm"
                onClick={() => setShowCreateModal(true)}
              >
                + New Agent
              </Button>
              
              <Button
                variant="flat"
                size="sm"
                onClick={loadAgents}
                isLoading={isLoading}
              >
                Refresh
              </Button>
            </div>
          </div>
        </Card.Header>
        
        <Card.Body>
          <Table
            aria-label="Agents table"
            css={{ minWidth: '100%' }}
            selectionMode="single"
            onSelectionChange={(keys) => {
              const id = Array.from(keys)[0] as string;
              const agent = agents.find(a => a.id === id);
              if (agent) {
                setSelectedAgent(agent);
                onAgentSelect?.(agent);
              }
            }}
          >
            <Table.Header>
              <Table.Column>Agent ID</Table.Column>
              <Table.Column>Status</Table.Column>
              <Table.Column>Roles</Table.Column>
              <Table.Column>Created</Table.Column>
              <Table.Column>Last Activity</Table.Column>
              <Table.Column align="center">Actions</Table.Column>
            </Table.Header>
            
            <Table.Body>
              {agents.map(agent => (
                <Table.Row key={agent.id}>
                  <Table.Cell>
                    <User
                      name={agent.id}
                      description={`ID: ${agent.id.substring(0, 8)}...`}
                      avatarProps={{
                        name: agent.id[0].toUpperCase(),
                        color: agent.status === 'active' ? 'success' : 'warning'
                      }}
                    />
                  </Table.Cell>
                  
                  <Table.Cell>
                    <StatusBadge status={agent.status || 'inactive'} />
                  </Table.Cell>
                  
                  <Table.Cell>
                    <RoleBadges roles={agent.roles} />
                  </Table.Cell>
                  
                  <Table.Cell>
                    <Tooltip content={new Date(agent.created_at).toLocaleString()}>
                      <span style={{ fontSize: '0.9rem', color: '#666' }}>
                        {formatDistanceToNow(new Date(agent.created_at), { addSuffix: true })}
                      </span>
                    </Tooltip>
                  </Table.Cell>
                  
                  <Table.Cell>
                    {agent.last_activity && (
                      <span style={{ fontSize: '0.9rem', color: '#666' }}>
                        {formatDistanceToNow(new Date(agent.last_activity), { addSuffix: true })}
                      </span>
                    )}
                  </Table.Cell>
                  
                  <Table.Cell>
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                      <Tooltip content="Inspect agent">
                        <Button
                          size="sm"
                          variant="flat"
                          isIconOnly
                          onClick={() => {
                            setSelectedAgent(agent);
                            setShowInspector(true);
                          }}
                        >
                          👁️
                        </Button>
                      </Tooltip>
                      
                      {onLinkToNode && (
                        <Tooltip content="Link to node">
                          <Button
                            size="sm"
                            variant="flat"
                            isIconOnly
                            onClick={() => onLinkToNode(agent.id)}
                          >
                            🔗
                          </Button>
                        </Tooltip>
                      )}
                      
                      <Tooltip content="Delete agent">
                        <Button
                          size="sm"
                          color="danger"
                          variant="flat"
                          isIconOnly
                          onClick={() => handleAgentDelete(agent.id)}
                        >
                          🗑️
                        </Button>
                      </Tooltip>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          
          {agents.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem',
              color: '#666'
            }}>
              No agents found. Create your first agent to get started.
            </div>
          )}
        </Card.Body>
      </Card>
      
      {/* Create Agent Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        size="lg"
      >
        <Modal.Header>
          <h3>Create New Agent</h3>
        </Modal.Header>
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input
              label="Agent ID"
              placeholder="agent-name-001"
              value={newAgentId}
              onChange={(e) => setNewAgentId(e.target.value)}
              description="Unique identifier for the agent"
            />
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Roles</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {['emitter', 'subscriber', 'curator'].map(role => (
                  <Checkbox
                    key={role}
                    isSelected={newAgentRoles.includes(role)}
                    onValueChange={(checked) => {
                      if (checked) {
                        setNewAgentRoles([...newAgentRoles, role]);
                      } else {
                        setNewAgentRoles(newAgentRoles.filter(r => r !== role));
                      }
                    }}
                  >
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Checkbox>
                ))}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="flat" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button
            color="primary"
            onClick={handleCreateAgent}
            isLoading={isLoading}
            isDisabled={!newAgentId || newAgentRoles.length === 0}
          >
            Create Agent
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Agent Inspector Modal */}
      {selectedAgent && (
        <Modal
          isOpen={showInspector}
          onClose={() => setShowInspector(false)}
          size="xl"
        >
          <Modal.Header>
            <h3>Agent Inspector: {selectedAgent.id}</h3>
          </Modal.Header>
          <Modal.Body>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <strong>Status:</strong> <StatusBadge status={selectedAgent.status || 'inactive'} />
              </div>
              <div>
                <strong>Roles:</strong> <RoleBadges roles={selectedAgent.roles} />
              </div>
              <div>
                <strong>Created:</strong> {new Date(selectedAgent.created_at).toLocaleString()}
              </div>
              <div>
                <strong>Last Activity:</strong> {
                  selectedAgent.last_activity 
                    ? new Date(selectedAgent.last_activity).toLocaleString()
                    : 'No activity'
                }
              </div>
              {selectedAgent.metadata && (
                <div>
                  <strong>Metadata:</strong>
                  <pre style={{ 
                    background: '#f4f4f4', 
                    padding: '0.5rem',
                    borderRadius: '4px',
                    overflow: 'auto'
                  }}>
                    {JSON.stringify(selectedAgent.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="flat" onClick={() => setShowInspector(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
};
