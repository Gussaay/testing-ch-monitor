// components/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Card, PageHeader, Table, Button, EmptyState, Spinner } from './CommonComponents';
import { listUsers, updateUserAccess } from '../data.js';
import { auth } from '../firebase';

export function AdminDashboard({ isAdmin }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    } else {
      setLoading(false);
      setError("You do not have administrative access to this page.");
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Use the Firestore-based listUsers function instead of Cloud Functions
      const userList = await listUsers();
      setUsers(userList);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setError("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccessToggle = async (userId, module, currentAccess) => {
    try {
      const newAccess = !currentAccess;
      await updateUserAccess(userId, module, newAccess);
      // Update the local state to reflect the change
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, access: { ...user.access, [module]: newAccess } } : user
        )
      );
    } catch (err) {
      console.error("Failed to update user access:", err);
      setError("Failed to update access. Please try again.");
      // Re-fetch users to revert optimistic update if it fails
      fetchUsers();
    }
  };

  if (loading) {
    return <Card><Spinner /></Card>;
  }

  if (error) {
    return <Card><EmptyState message={error} /></Card>;
  }

  const headers = ["User Email", "IMNCI", "ETAT", "EENC", "Last Login"];

  return (
    <Card>
      <PageHeader title="Admin Dashboard" subtitle="Manage user access to different modules." />
      {users.length === 0 ? (
        <EmptyState message="No registered users found." />
      ) : (
        <Table headers={headers}>
          {users.map(user => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="p-4 border">{user.email}</td>
              <td className="p-4 border">
                <Button
                  variant={user.access?.IMNCI ? 'primary' : 'danger'}
                  onClick={() => handleAccessToggle(user.id, 'IMNCI', user.access?.IMNCI)}
                >
                  {user.access?.IMNCI ? 'Enabled' : 'Disabled'}
                </Button>
              </td>
              <td className="p-4 border">
                <Button
                  variant={user.access?.ETAT ? 'primary' : 'danger'}
                  onClick={() => handleAccessToggle(user.id, 'ETAT', user.access?.ETAT)}
                >
                  {user.access?.ETAT ? 'Enabled' : 'Disabled'}
                </Button>
              </td>
              <td className="p-4 border">
                <Button
                  variant={user.access?.EENC ? 'primary' : 'danger'}
                  onClick={() => handleAccessToggle(user.id, 'EENC', user.access?.EENC)}
                >
                  {user.access?.EENC ? 'Enabled' : 'Disabled'}
                </Button>
              </td>
              <td className="p-4 border">{user.lastLogin?.toDate().toLocaleString() || 'N/A'}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}