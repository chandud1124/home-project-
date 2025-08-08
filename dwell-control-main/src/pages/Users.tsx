
import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users as UsersIcon, Plus, Shield, User, Edit, Trash2, GraduationCap, ShieldCheck } from 'lucide-react';
import { UserDialog } from '@/components/UserDialog';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'security' | 'faculty';
  isActive: boolean;
  lastLogin: Date;
  assignedDevices: string[];
  department?: string;
  accessLevel: 'full' | 'limited' | 'readonly';
}

const Users = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      name: 'Admin User',
      email: 'admin@college.edu',
      role: 'admin',
      isActive: true,
      lastLogin: new Date(Date.now() - 300000),
      assignedDevices: ['1', '2'],
      department: 'IT Department',
      accessLevel: 'full'
    },
    {
      id: '2',
      name: 'Dr. John Smith',
      email: 'john.smith@college.edu',
      role: 'faculty',
      isActive: true,
      lastLogin: new Date(Date.now() - 3600000),
      assignedDevices: ['1'],
      department: 'Computer Science',
      accessLevel: 'limited'
    },
    {
      id: '3',
      name: 'Security Officer',
      email: 'security@college.edu',
      role: 'security',
      isActive: true,
      lastLogin: new Date(Date.now() - 1800000),
      assignedDevices: ['1', '2'],
      department: 'Security',
      accessLevel: 'readonly'
    }
  ]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleAddUser = (userData: any) => {
    const newUser: User = {
      id: Date.now().toString(),
      isActive: true,
      lastLogin: new Date(),
      ...userData
    };
    
    setUsers(prev => [...prev, newUser]);
    toast({
      title: "User Added",
      description: `${userData.name} has been added successfully`
    });
  };

  const handleEditUser = (userData: any) => {
    if (!editingUser) return;
    
    setUsers(prev => 
      prev.map(user => 
        user.id === editingUser.id 
          ? { ...user, ...userData }
          : user
      )
    );
    
    setEditingUser(null);
    toast({
      title: "User Updated",
      description: `${userData.name} has been updated successfully`
    });
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    toast({
      title: "User Deleted",
      description: "User has been removed successfully"
    });
  };

  const toggleUserStatus = (userId: string) => {
    setUsers(prev => 
      prev.map(user => 
        user.id === userId 
          ? { ...user, isActive: !user.isActive }
          : user
      )
    );
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'faculty': return <GraduationCap className="w-4 h-4" />;
      case 'security': return <ShieldCheck className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'faculty': return 'secondary';
      case 'security': return 'destructive';
      default: return 'outline';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const formatLastLogin = (date: Date) => {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              User Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage faculty, security, and student access to classroom automation
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-12">
            <UsersIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No users found</h3>
            <p className="text-muted-foreground mb-4">
              Add users to manage access to your classroom automation system
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First User
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => (
              <Card key={user.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{user.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.department && (
                        <p className="text-xs text-muted-foreground">{user.department}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Role:</span>
                      <Badge variant={getRoleColor(user.role)} className="flex items-center gap-1">
                        {getRoleIcon(user.role)}
                        {user.role}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status:</span>
                      <Badge variant={user.isActive ? 'default' : 'secondary'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Access:</span>
                      <Badge variant="outline" className="capitalize">
                        {user.accessLevel}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Last Login:</span>
                      <span className="text-sm">{formatLastLogin(user.lastLogin)}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Assigned Devices:</span>
                      <div className="text-xs text-muted-foreground mt-1">
                        {user.assignedDevices.length} classroom(s) assigned
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingUser(user);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant={user.isActive ? 'secondary' : 'default'}
                        onClick={() => toggleUserStatus(user.id)}
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <UserDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingUser(null);
          }}
          onSave={editingUser ? handleEditUser : handleAddUser}
          user={editingUser}
        />
      </div>
    </Layout>
  );
};

export default Users;
