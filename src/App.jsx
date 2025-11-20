

import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc,
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Clock, 
  CalendarDays, 
  CheckSquare, 
  Users, 
  LogOut, 
  Briefcase, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,       
  Trash2,       
  Plus,         
  ChevronLeft,  
  ChevronRight,
  ClipboardList,
  History,
  X,
  BarChart3,
  PieChart,
  Filter,
  MapPin,
  ArrowRight,
  ListTodo,
  UserCircle,
  Calendar,
  TrendingUp
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Constants & Utils ---
const COLLECTIONS = {
  USERS: 'users',
  ATTENDANCE: 'attendance',
  LEAVE: 'leave_requests',
  TASKS: 'tasks'
};

const LEAVE_TYPES = ['Sick Leave', 'Vacation', 'Personal', 'Remote Work'];
const TASK_STATUS = { PENDING: 'pending', COMPLETED: 'completed' };

// --- Helper Functions ---

// Safely convert Firestore Timestamp to Date object
const safeDate = (timestamp) => {
  if (!timestamp || !timestamp.seconds) return null;
  return new Date(timestamp.seconds * 1000);
};

const formatDate = (timestamp) => {
  const date = safeDate(timestamp);
  if (!date) return '...';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (timestamp) => {
  const date = safeDate(timestamp);
  if (!date) return '-- : --';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// Helper to format YYYY-MM-DD string to nice text
const formatDueDate = (dateString) => {
  if (!dateString) return null;
  // Create date using split/construct to avoid timezone shifts on simple dates
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d); 
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// --- Components ---

// --- NEW COMPONENT: Manager Analytics View ---
const ManagerStatsView = ({ users, attendance, leaves, tasks }) => {
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'daysPresent', direction: 'desc' });

  const uniqueBranches = useMemo(() => Array.from(new Set(users.map(u => u.branch).filter(b => b))).sort(), [users]);

  const statsData = useMemo(() => {
    const employees = users.filter(u => u.role === 'employee');
    const filteredByBranch = branchFilter === 'all' ? employees : employees.filter(u => u.branch === branchFilter);

    return filteredByBranch.map(u => {
      const userAtt = attendance.filter(a => {
        const d = safeDate(a.timestamp);
        return a.userId === u.id && d && d.toISOString().split('T')[0] >= startDate && d.toISOString().split('T')[0] <= endDate;
      });
      
      const userLeaves = leaves.filter(l => 
        l.userId === u.id && l.status === 'approved' && l.startDate >= startDate && l.startDate <= endDate
      );

      const userTasks = tasks.filter(t => t.userId === u.id && t.status === TASK_STATUS.PENDING);

      const daysPresent = new Set(userAtt.map(r => {
        const d = safeDate(r.timestamp);
        return d ? d.toDateString() : 'unknown';
      })).size;
      
      const sortedAtt = [...userAtt].sort((a,b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
      let totalMs = 0;
      let lastIn = null;
      sortedAtt.forEach(r => {
         if(r.type === 'check-in') lastIn = r.timestamp.seconds * 1000;
         else if(r.type === 'check-out' && lastIn) {
             totalMs += (r.timestamp.seconds * 1000) - lastIn;
             lastIn = null;
         }
      });
      const totalHours = parseFloat((totalMs / (1000 * 60 * 60)).toFixed(1));

      return {
        id: u.id,
        name: u.name,
        branch: u.branch,
        position: u.position,
        daysPresent,
        totalHours,
        leaves: userLeaves.length,
        pendingTasks: userTasks.length
      };
    });
  }, [users, attendance, leaves, tasks, startDate, endDate, branchFilter]);

  const sortedStats = useMemo(() => {
    return [...statsData].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [statsData, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Performance Analytics</h2>
        <div className="flex flex-wrap gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-2 px-2">
             <span className="text-xs font-semibold text-gray-500 uppercase">Date Range:</span>
             <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-gray-400">-</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="border-l border-gray-200 pl-3">
             <select 
              value={branchFilter} 
              onChange={(e) => setBranchFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Branches</option>
              {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
         <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase">Total Man-Hours</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{statsData.reduce((acc, cur) => acc + cur.totalHours, 0).toFixed(1)} h</p>
         </div>
         <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase">Total Days Present</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{statsData.reduce((acc, cur) => acc + cur.daysPresent, 0)}</p>
         </div>
         <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase">Total Leaves Taken</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">{statsData.reduce((acc, cur) => acc + cur.leaves, 0)}</p>
         </div>
         <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase">Pending Tasks</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{statsData.reduce((acc, cur) => acc + cur.pendingTasks, 0)}</p>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700 font-medium">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('name')}>
                   <div className="flex items-center">Employee {sortConfig.key === 'name' && <span className="ml-1 text-gray-400">▼</span>}</div>
                </th>
                <th className="px-6 py-4">Branch</th>
                <th className="px-6 py-4 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('daysPresent')}>
                   <div className="flex items-center justify-center">Days Present {sortConfig.key === 'daysPresent' && <span className="ml-1 text-gray-400">▼</span>}</div>
                </th>
                <th className="px-6 py-4 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('totalHours')}>
                   <div className="flex items-center justify-center">Total Hours {sortConfig.key === 'totalHours' && <span className="ml-1 text-gray-400">▼</span>}</div>
                </th>
                <th className="px-6 py-4 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('leaves')}>
                   <div className="flex items-center justify-center">Leaves {sortConfig.key === 'leaves' && <span className="ml-1 text-gray-400">▼</span>}</div>
                </th>
                <th className="px-6 py-4 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('pendingTasks')}>
                   <div className="flex items-center justify-center">Pending Tasks {sortConfig.key === 'pendingTasks' && <span className="ml-1 text-gray-400">▼</span>}</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedStats.map((stat) => (
                <tr key={stat.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{stat.name}</div>
                    <div className="text-xs text-gray-500">{stat.position}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{stat.branch}</td>
                  <td className="px-6 py-4 text-center font-medium text-indigo-600">{stat.daysPresent}</td>
                  <td className="px-6 py-4 text-center font-medium text-green-600">{stat.totalHours}</td>
                  <td className="px-6 py-4 text-center text-orange-600">{stat.leaves}</td>
                  <td className="px-6 py-4 text-center">
                    {stat.pendingTasks > 0 ? (
                      <span className="bg-red-50 text-red-600 px-2 py-1 rounded-full text-xs font-bold">{stat.pendingTasks}</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {sortedStats.length === 0 && (
                <tr><td colSpan="6" className="text-center py-8 text-gray-400">No data found for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const LoginScreen = ({ users, onLogin, seeding }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden">
      <div className="bg-indigo-600 p-8 text-center">
        <Briefcase className="w-12 h-12 text-white mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white">WorkForce Pro</h1>
        <p className="text-indigo-200">Employee Management Platform</p>
      </div>
      <div className="p-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Select User to Simulate</h2>
        {seeding ? (
          <div className="text-center py-8 text-gray-500 animate-pulse">Initializing Database...</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => onLogin(u)}
                className="w-full flex items-center p-3 hover:bg-indigo-50 border border-gray-200 rounded-xl transition-all group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${u.role === 'manager' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                  {u.name.charAt(0)}
                </div>
                <div className="ml-3 text-left flex-1">
                  <div className="font-medium text-gray-800 group-hover:text-indigo-700">{u.name}</div>
                  <div className="text-xs text-gray-500">{u.position} • {u.branch}</div>
                </div>
                <div className="text-xs font-semibold text-gray-400 px-2 py-1 bg-gray-100 rounded">
                  {u.role.toUpperCase()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

const Sidebar = ({ user, activeTab, setActiveTab, onLogout }) => {
  const personalMenu = [
    { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'Check In/Out', icon: Clock },
    { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
    { id: 'leave', label: 'Leave/Sick', icon: CalendarDays },
  ];

  const managementMenu = [
    { id: 'manager_overview', label: 'Team Overview', icon: BarChart3 },
    { id: 'manager_stats', label: 'Analytics', icon: TrendingUp },
    { id: 'daily_status', label: 'Daily Status', icon: ClipboardList },
    { id: 'employee_tasks', label: 'Employee Tasks', icon: ListTodo },
    { id: 'employees', label: 'Directory', icon: Users },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle2 },
  ];

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full fixed left-0 top-0 z-10">
      <div className="p-6 flex items-center space-x-3 text-white font-bold text-xl tracking-tight">
        <Briefcase className="w-6 h-6 text-indigo-400" />
        <span>WorkForce</span>
      </div>
      
      <div className="px-6 py-4">
        <div className="flex items-center space-x-3 bg-slate-800 p-3 rounded-lg">
          <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
            {user.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.position}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
        {user.role === 'manager' && (
          <>
            <div className="px-4 py-2 mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Management
            </div>
            {managementMenu.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors mb-1 ${
                  activeTab === item.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            ))}
            <div className="px-4 py-2 mt-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              My Workspace
            </div>
          </>
        )}

        {personalMenu.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors mb-1 ${
              activeTab === item.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-2 text-slate-400 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Switch User</span>
        </button>
      </div>
    </div>
  );
};

const ManagerTaskView = ({ users, tasks }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');

  const filteredTasks = tasks.filter(task => {
    const matchesEmployee = selectedEmployee === 'all' || task.userId === selectedEmployee;
    const matchesStatus = task.status === statusFilter;
    return matchesEmployee && matchesStatus;
  });

  const sortedTasks = filteredTasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Employee Tasks</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white"
            >
              <option value="all">All Employees</option>
              {users.filter(u => u.role === 'employee').map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.branch})</option>
              ))}
            </select>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                statusFilter === 'pending' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                statusFilter === 'completed' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Completed
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-gray-700 flex items-center">
            <ListTodo className="w-4 h-4 mr-2" /> 
            {statusFilter === 'pending' ? 'Pending Tasks' : 'Completed History'}
            <span className="ml-2 bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
              {sortedTasks.length}
            </span>
          </h3>
        </div>

        <div className="divide-y divide-gray-100">
          {sortedTasks.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="flex justify-center mb-3">
                <CheckSquare className="w-12 h-12 opacity-20" />
              </div>
              <p>No {statusFilter} tasks found for this selection.</p>
            </div>
          ) : (
            sortedTasks.map(task => {
              const taskUser = users.find(u => u.id === task.userId);
              return (
                <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start space-x-4">
                  <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    task.status === 'completed' ? 'border-green-500 bg-green-50' : 'border-gray-300'
                  }`}>
                    {task.status === 'completed' && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          {task.title}
                        </p>
                        {task.dueDate && (
                          <p className="text-xs text-red-500 flex items-center mt-0.5">
                            <Calendar className="w-3 h-3 mr-1" /> Due: {formatDueDate(task.dueDate)}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {formatDate(task.createdAt)}
                      </span>
                    </div>
                    
                    <div className="flex items-center mt-2 space-x-2">
                      <div className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                        <UserCircle className="w-3 h-3 mr-1" />
                        {taskUser ? taskUser.name : 'Unknown User'}
                      </div>
                      {taskUser && (
                        <span className="text-xs text-gray-400">• {taskUser.position}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const AttendanceView = ({ user, recordAttendance, attendance }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const todayRecords = attendance
    .filter(a => {
      const d = safeDate(a.timestamp);
      return a.userId === user.id && d && d.toISOString().split('T')[0] === todayStr;
    })
    .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

  const isCheckedIn = todayRecords.length > 0 && todayRecords[todayRecords.length - 1].type === 'check-in';

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-indigo-50 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Time Attendance</h2>
        <p className="text-gray-500 mb-8">{formatDate({ seconds: new Date().getTime() / 1000 })}</p>
        
        <div className="relative inline-block">
          <button
            onClick={() => recordAttendance(isCheckedIn ? 'check-out' : 'check-in')}
            className={`w-48 h-48 rounded-full border-8 flex flex-col items-center justify-center transition-all transform hover:scale-105 active:scale-95 ${
              isCheckedIn 
                ? 'border-red-100 bg-red-50 text-red-600 hover:border-red-200' 
                : 'border-green-100 bg-green-50 text-green-600 hover:border-green-200'
            }`}
          >
            <span className="text-4xl mb-2">{isCheckedIn ? <LogOut /> : <Clock />}</span>
            <span className="text-lg font-bold">{isCheckedIn ? 'Clock Out' : 'Clock In'}</span>
          </button>
        </div>
        
        <p className="mt-6 text-sm text-gray-500">
          {isCheckedIn 
            ? 'You are currently clocked in.' 
            : 'You are currently clocked out.'}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700">Today's Log</h3>
        </div>
        <div className="p-4 space-y-2">
          {todayRecords.length === 0 && <p className="text-gray-400 text-center py-4">No records for today.</p>}
          {todayRecords.map(record => (
            <div key={record.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className={`font-medium ${record.type === 'check-in' ? 'text-green-600' : 'text-red-600'}`}>
                {record.type === 'check-in' ? 'Checked In' : 'Checked Out'}
              </span>
              <span className="font-mono text-gray-600">
                {formatTime(record.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TaskView = ({ user, tasks, toggleTask, addTask }) => {
  const [newTask, setNewTask] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    addTask(newTask, newDueDate);
    setNewTask('');
    setNewDueDate('');
  };

  const myTasks = tasks.filter(t => t.userId === user.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">My Tasks</h2>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
             <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a new task..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="w-full md:w-48">
             <input 
               type="date"
               value={newDueDate}
               onChange={(e) => setNewDueDate(e.target.value)}
               className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600"
             />
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap">
            Add Task
          </button>
        </form>

        <div className="space-y-3">
          {myTasks.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>No tasks yet. Add one above!</p>
            </div>
          )}
          {myTasks.map(task => (
            <div 
              key={task.id} 
              className={`flex items-center p-4 rounded-lg border transition-all ${
                task.status === TASK_STATUS.COMPLETED 
                  ? 'bg-gray-50 border-gray-100' 
                  : 'bg-white border-gray-200 hover:border-indigo-300'
              }`}
            >
              <button 
                onClick={() => toggleTask(task)}
                className={`w-6 h-6 rounded border mr-4 flex items-center justify-center transition-colors ${
                  task.status === TASK_STATUS.COMPLETED ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent hover:border-indigo-500'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <div className="flex-1">
                 <span className={`block ${task.status === TASK_STATUS.COMPLETED ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                   {task.title}
                 </span>
                 {task.dueDate && (
                   <span className={`text-xs flex items-center mt-1 ${task.status === TASK_STATUS.COMPLETED ? 'text-gray-300' : 'text-red-500'}`}>
                     <Calendar className="w-3 h-3 mr-1" /> Due: {formatDueDate(task.dueDate)}
                   </span>
                 )}
              </div>
              <span className="text-xs text-gray-400 ml-2">{formatDate(task.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const LeaveView = ({ user, leaves, submitLeave }) => {
  const [formData, setFormData] = useState({ type: LEAVE_TYPES[0], startDate: '', endDate: '', reason: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!formData.startDate || !formData.endDate) return;
    submitLeave(formData);
    setFormData({ type: LEAVE_TYPES[0], startDate: '', endDate: '', reason: '' });
  };

  const myLeaves = leaves.filter(l => l.userId === user.id).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Request Leave</h2>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
              <select 
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
              >
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input 
                  type="date" 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  value={formData.startDate}
                  onChange={e => setFormData({...formData, startDate: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input 
                  type="date" 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  value={formData.endDate}
                  onChange={e => setFormData({...formData, endDate: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea 
                className="w-full border border-gray-200 rounded-lg px-3 py-2 h-24"
                placeholder="Optional details..."
                value={formData.reason}
                onChange={e => setFormData({...formData, reason: e.target.value})}
              />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              Submit Request
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">History</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {myLeaves.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No leave history found.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {myLeaves.map(leave => (
                <div key={leave.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-800">{leave.type}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full capitalize ${
                      leave.status === 'approved' ? 'bg-green-100 text-green-700' :
                      leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {leave.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{leave.startDate} to {leave.endDate}</p>
                  {leave.reason && <p className="text-xs text-gray-400 mt-1 line-clamp-1">"{leave.reason}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EmployeeHistoryModal = ({ targetUser, attendance, leaves, onClose }) => {
  const [activeTab, setActiveTab] = useState('stats');
  const [filterType, setFilterType] = useState('monthly'); 
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  const filteredData = useMemo(() => {
    const filteredAtt = attendance.filter(a => {
      const d = safeDate(a.timestamp);
      if (!d || a.userId !== targetUser.id) return false;
      if (filterType === 'daily') return d.toISOString().split('T')[0] === filterDate;
      if (filterType === 'monthly') return d.toISOString().slice(0, 7) === filterMonth;
      if (filterType === 'yearly') return d.getFullYear().toString() === filterYear;
      return true;
    });

    const filteredLeaves = leaves.filter(l => {
      if (l.userId !== targetUser.id || l.status !== 'approved') return false;
      if (filterType === 'daily') return l.startDate === filterDate;
      if (filterType === 'monthly') return l.startDate.startsWith(filterMonth);
      if (filterType === 'yearly') return l.startDate.startsWith(filterYear);
      return true;
    });

    return { attendance: filteredAtt, leaves: filteredLeaves };
  }, [attendance, leaves, targetUser.id, filterType, filterDate, filterMonth, filterYear]);

  const stats = useMemo(() => {
    const { attendance: atts, leaves: lvs } = filteredData;
    const daysPresent = new Set(atts.map(r => {
      const d = safeDate(r.timestamp);
      return d ? d.toDateString() : '';
    })).size;
    
    const sorted = [...atts].sort((a,b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
    let totalMs = 0;
    let lastIn = null;
    
    sorted.forEach(r => {
        if (r.type === 'check-in') {
            lastIn = r.timestamp?.seconds * 1000;
        } else if (r.type === 'check-out' && lastIn) {
            totalMs += (r.timestamp?.seconds * 1000) - lastIn;
            lastIn = null;
        }
    });
    
    const totalHours = (totalMs / (1000 * 60 * 60));
    const avgHours = daysPresent > 0 ? (totalHours / daysPresent) : 0;

    return {
      daysPresent,
      totalHours: totalHours.toFixed(1),
      avgHours: avgHours.toFixed(1),
      leavesTaken: lvs.length
    };
  }, [filteredData]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center space-x-4">
             <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
               {targetUser.name.charAt(0)}
             </div>
             <div>
               <h3 className="text-xl font-bold text-gray-800">{targetUser.name}</h3>
               <p className="text-sm text-gray-500">{targetUser.position} • {targetUser.branch}</p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex border-b border-gray-100">
          {[
            { id: 'stats', label: 'Statistics', icon: BarChart3 },
            { id: 'attendance', label: 'Attendance Log', icon: ClipboardList },
            { id: 'leaves', label: 'Leave History', icon: CalendarDays }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex-1 min-w-[150px]">
                   <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Filter By</label>
                   <select 
                     value={filterType} 
                     onChange={(e) => setFilterType(e.target.value)}
                     className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                   >
                     <option value="daily">Specific Date</option>
                     <option value="monthly">Month</option>
                     <option value="yearly">Year</option>
                   </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                   <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Select Period</label>
                   {filterType === 'daily' && (
                     <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg bg-white" />
                   )}
                   {filterType === 'monthly' && (
                     <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg bg-white" />
                   )}
                   {filterType === 'yearly' && (
                     <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg bg-white">
                       {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                     </select>
                   )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                   <p className="text-xs text-blue-600 font-bold uppercase mb-1">Days Present</p>
                   <p className="text-2xl font-bold text-gray-800">{stats.daysPresent}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                   <p className="text-xs text-green-600 font-bold uppercase mb-1">Total Hours</p>
                   <p className="text-2xl font-bold text-gray-800">{stats.totalHours}h</p>
                </div>
                 <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                   <p className="text-xs text-purple-600 font-bold uppercase mb-1">Avg Hrs/Day</p>
                   <p className="text-2xl font-bold text-gray-800">{stats.avgHours}h</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                   <p className="text-xs text-orange-600 font-bold uppercase mb-1">Leaves</p>
                   <p className="text-2xl font-bold text-gray-800">{stats.leavesTaken}</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                   <ClipboardList className="w-4 h-4 mr-2 text-gray-400"/> 
                   Records in Period ({filteredData.attendance.length})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredData.attendance.length === 0 && <p className="text-gray-400 text-sm italic">No attendance records found for this period.</p>}
                  {filteredData.attendance
                    .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                    .map(record => (
                    <div key={record.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                      <span className={`capitalize font-medium ${record.type === 'check-in' ? 'text-green-600' : 'text-red-600'}`}>{record.type.replace('-', ' ')}</span>
                      <div className="text-right">
                        <span className="text-gray-900 font-bold block">{formatTime(record.timestamp)}</span>
                        <span className="text-gray-500 text-xs">{formatDate(record.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-3">
              {attendance.filter(a => a.userId === targetUser.id).length === 0 ? (
                <p className="text-center text-gray-400 py-8">No attendance records found.</p>
              ) : (
                 attendance
                   .filter(a => a.userId === targetUser.id)
                   .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                   .map(record => (
                   <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${record.type === 'check-in' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="font-medium text-gray-700 capitalize">{record.type.replace('-', ' ')}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-800">{formatTime(record.timestamp)}</div>
                        <div className="text-xs text-gray-400">{formatDate(record.timestamp)}</div>
                      </div>
                   </div>
                 ))
              )}
            </div>
          )}

          {activeTab === 'leaves' && (
            <div className="space-y-3">
              {leaves.filter(l => l.userId === targetUser.id).length === 0 ? (
                <p className="text-center text-gray-400 py-8">No leave requests found.</p>
              ) : (
                leaves
                  .filter(l => l.userId === targetUser.id)
                  .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                  .map(leave => (
                  <div key={leave.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-gray-800">{leave.type}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full capitalize ${
                        leave.status === 'approved' ? 'bg-green-100 text-green-700' :
                        leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {leave.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {leave.startDate} <span className="text-gray-400">to</span> {leave.endDate}
                    </p>
                    {leave.reason && <p className="text-xs text-gray-500 mt-2 italic">"{leave.reason}"</p>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EmployeesList = ({ users, attendance, leaves, tasks, onAddUser, onDeleteUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); 
  const [branchFilter, setBranchFilter] = useState('all'); 
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ 
    name: '', employeeId: '', branch: '', position: '', role: 'employee' 
  });
  const [historyUser, setHistoryUser] = useState(null);

  const itemsPerPage = 10;

  const uniqueBranches = useMemo(() => {
    return Array.from(new Set(users.map(u => u.branch).filter(b => b))).sort();
  }, [users]);

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.branch.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesBranch = branchFilter === 'all' || u.branch === branchFilter;

    return matchesSearch && matchesRole && matchesBranch;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const currentUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.employeeId) return;
    onAddUser(newUser);
    setIsModalOpen(false);
    setNewUser({ name: '', employeeId: '', branch: '', position: '', role: 'employee' });
    setCurrentPage(1); 
  };

  const handleDeleteClick = (userId) => {
    if (window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      onDeleteUser(userId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Employee Directory</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Employee
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text"
            placeholder="Search by name or ID..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="relative w-full md:w-48">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white text-gray-600"
          >
            <option value="all">All Roles</option>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
          </select>
        </div>

        <div className="relative w-full md:w-48">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <select
            value={branchFilter}
            onChange={(e) => { setBranchFilter(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white text-gray-600"
          >
            <option value="all">All Branches</option>
            {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700 font-medium">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Branch</th>
                <th className="px-6 py-4">Position</th>
                <th className="px-6 py-4">Tasks</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentUsers.length > 0 ? (
                currentUsers.map(user => {
                  const pendingCount = tasks ? tasks.filter(t => t.userId === user.id && t.status === TASK_STATUS.PENDING).length : 0;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-bold ${user.role === 'manager' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-400">{user.employeeId}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{user.branch}</td>
                      <td className="px-6 py-4">{user.position}</td>
                      <td className="px-6 py-4">
                        {pendingCount > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                             {pendingCount} Pending
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No pending tasks</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => setHistoryUser(user)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View History & Stats"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(user.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove Employee"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400 bg-gray-50">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="w-12 h-12 text-gray-300 mb-2" />
                      <p>No employees found matching your filters.</p>
                      <button 
                         onClick={() => { setSearchTerm(''); setRoleFilter('all'); setBranchFilter('all'); }}
                         className="mt-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {filteredUsers.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredUsers.length)}</span> of <span className="font-medium">{filteredUsers.length}</span> results
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Add New Employee</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  placeholder="e.g. Alex Johnson"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                  <input 
                    required
                    type="text" 
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    value={newUser.employeeId}
                    onChange={e => setNewUser({...newUser, employeeId: e.target.value})}
                    placeholder="e.g. EMP005"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select 
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value})}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    value={newUser.branch}
                    onChange={e => setNewUser({...newUser, branch: e.target.value})}
                    placeholder="e.g. London"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    value={newUser.position}
                    onChange={e => setNewUser({...newUser, position: e.target.value})}
                    placeholder="e.g. Sales"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyUser && (
        <EmployeeHistoryModal 
          targetUser={historyUser} 
          attendance={attendance} 
          leaves={leaves} 
          onClose={() => setHistoryUser(null)} 
        />
      )}
    </div>
  );
};

const DailyStatusView = ({ users, attendance }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const employees = users.filter(u => u.role === 'employee');

  const presentUserIds = new Set(attendance
    .filter(a => {
      const d = safeDate(a.timestamp);
      return d && d.toISOString().split('T')[0] === todayStr && a.type === 'check-in';
    })
    .map(a => a.userId)
  );

  const presentEmployees = employees.filter(u => presentUserIds.has(u.id));
  const absentEmployees = employees.filter(u => !presentUserIds.has(u.id));

  const EmployeeCard = ({ user, status, checkInTime }) => (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
       <div className="flex items-center space-x-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${status === 'present' ? 'bg-green-500' : 'bg-gray-300'}`}>
             {user.name.charAt(0)}
          </div>
          <div>
             <h4 className="font-bold text-gray-800">{user.name}</h4>
             <p className="text-xs text-gray-500">{user.position}</p>
          </div>
       </div>
       <div className={`px-3 py-1 rounded-full text-xs font-bold ${status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {status === 'present' ? checkInTime : 'Absent'}
       </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold text-gray-800">Daily Attendance Status</h2>
         <span className="text-gray-500 bg-gray-100 px-3 py-1 rounded-lg text-sm font-medium">{formatDate({ seconds: new Date().getTime() / 1000 })}</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
           <div className="flex items-center justify-between mb-2">
             <h3 className="font-semibold text-gray-700 flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-green-500"/> Present ({presentEmployees.length})</h3>
           </div>
           {presentEmployees.length === 0 && <p className="text-gray-400 text-sm italic">No one has checked in yet.</p>}
           {presentEmployees.map(u => {
              const record = attendance.find(a => {
                const d = safeDate(a.timestamp);
                return a.userId === u.id && d.toISOString().split('T')[0] === todayStr && a.type === 'check-in';
              });
              return <EmployeeCard key={u.id} user={u} status="present" checkInTime={formatTime(record.timestamp)} />;
           })}
        </div>

        <div className="space-y-4">
           <div className="flex items-center justify-between mb-2">
             <h3 className="font-semibold text-gray-700 flex items-center"><XCircle className="w-4 h-4 mr-2 text-red-500"/> Absent ({absentEmployees.length})</h3>
           </div>
           {absentEmployees.length === 0 && <p className="text-gray-400 text-sm italic">Everyone is present!</p>}
           {absentEmployees.map(u => <EmployeeCard key={u.id} user={u} status="absent" />)}
        </div>
      </div>
    </div>
  );
};

const EmployeeDashboard = ({ user, attendance, tasks, leaves, onNavigate }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const todayAttendance = attendance.find(a => {
    const d = safeDate(a.timestamp);
    return a.userId === user.id && d && d.toISOString().split('T')[0] === todayStr;
  });

  const pendingTasksList = tasks.filter(t => t.userId === user.id && t.status === TASK_STATUS.PENDING);
  const pendingTasks = pendingTasksList.length;
  const approvedLeaves = leaves.filter(l => l.userId === user.id && l.status === 'approved').length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Welcome back, {user.name}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => onNavigate('attendance')}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Clock className="w-6 h-6" /></div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${todayAttendance ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {todayAttendance ? 'Checked In' : 'Not Checked In'}
            </span>
          </div>
          <p className="text-sm text-gray-500">Today's Status</p>
          <p className="text-2xl font-bold text-gray-800">
            {todayAttendance ? formatTime(todayAttendance.timestamp) : '-- : --'}
          </p>
        </div>

        <div 
          onClick={() => onNavigate('tasks')}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><CheckSquare className="w-6 h-6" /></div>
            <ArrowRight className="w-4 h-4 text-gray-300" />
          </div>
          <p className="text-sm text-gray-500">Pending Tasks</p>
          <p className="text-2xl font-bold text-gray-800">{pendingTasks}</p>
        </div>

        <div 
          onClick={() => onNavigate('leave')}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><CalendarDays className="w-6 h-6" /></div>
            <ArrowRight className="w-4 h-4 text-gray-300" />
          </div>
          <p className="text-sm text-gray-500">Approved Leaves (YTD)</p>
          <p className="text-2xl font-bold text-gray-800">{approvedLeaves} Days</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">Recent Activity</h3>
            <button onClick={() => onNavigate('attendance')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">View Log</button>
          </div>
          <div className="p-6">
            {attendance.filter(a => a.userId === user.id).length === 0 ? (
              <p className="text-gray-500 text-sm">No recent activity recorded.</p>
            ) : (
              <div className="space-y-4">
                {attendance
                  .filter(a => a.userId === user.id)
                  .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                  .slice(0, 5)
                  .map(record => (
                  <div key={record.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${record.type === 'check-in' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-gray-700 font-medium capitalize">{record.type.replace('-', ' ')}</span>
                    </div>
                    <span className="text-gray-500">
                      {formatDate(record.timestamp)} at {formatTime(record.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Tasks List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">Pending Tasks</h3>
            <button onClick={() => onNavigate('tasks')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">View All</button>
          </div>
          <div className="p-6">
             {pendingTasksList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                   <CheckSquare className="w-8 h-8 mb-2 opacity-20"/>
                   <p className="text-sm">No pending tasks.</p>
                </div>
             ) : (
                <div className="space-y-3">
                   {pendingTasksList.slice(0, 5).map(task => (
                      <div key={task.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                         <div className="mt-0.5 text-indigo-500">
                            <CheckSquare className="w-4 h-4" />
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                            {task.dueDate && <p className="text-xs text-red-500 mt-0.5">Due: {formatDueDate(task.dueDate)}</p>}
                         </div>
                      </div>
                   ))}
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ManagerDashboard = ({ users, attendance, leaves, onNavigate }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Stats Logic
  const totalEmployees = users.filter(u => u.role === 'employee').length;
  const presentToday = new Set(attendance
    .filter(a => {
      const d = safeDate(a.timestamp);
      return d && d.toISOString().split('T')[0] === todayStr && a.type === 'check-in';
    })
    .map(a => a.userId)
  ).size;
  
  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Manager Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => onNavigate('employees')}
          className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <p className="text-indigo-100 mb-1">Total Employees</p>
          <div className="flex items-end justify-between">
            <h3 className="text-4xl font-bold">{totalEmployees}</h3>
            <Users className="w-8 h-8 opacity-50" />
          </div>
        </div>
        
        <div 
          onClick={() => onNavigate('daily_status')}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer transition-transform hover:scale-[1.01] hover:shadow-md"
        >
          <p className="text-gray-500 mb-1">Present Today</p>
          <div className="flex items-end justify-between">
            <h3 className="text-4xl font-bold text-green-600">{presentToday}</h3>
            <div className="text-sm text-gray-400 mb-1">/ {totalEmployees} Active</div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mt-4">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(presentToday/totalEmployees)*100}%` }}></div>
          </div>
        </div>

        <div 
          onClick={() => onNavigate('approvals')}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer transition-transform hover:scale-[1.01] hover:shadow-md"
        >
          <p className="text-gray-500 mb-1">Pending Leaves</p>
          <div className="flex items-end justify-between">
            <h3 className="text-4xl font-bold text-orange-500">{pendingLeaves}</h3>
            <AlertCircle className="w-8 h-8 text-orange-200" />
          </div>
          <p className="text-xs text-gray-400 mt-4">Requires action</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">Presence by Branch</h3>
          <div className="space-y-4">
            {Array.from(new Set(users.filter(u=>u.role==='employee').map(u => u.branch))).map(branch => {
              const branchUsers = users.filter(u => u.branch === branch && u.role === 'employee');
              const branchPresent = branchUsers.filter(u => 
                 attendance.some(a => {
                   const d = safeDate(a.timestamp);
                   return a.userId === u.id && a.type === 'check-in' && d && d.toISOString().split('T')[0] === todayStr;
                 })
              ).length;
              return (
                <div key={branch}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{branch}</span>
                    <span className="font-bold text-gray-800">{branchPresent}/{branchUsers.length}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(branchPresent/branchUsers.length)*100}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
           <h3 className="font-bold text-gray-800 mb-4">Recent Activity Stream</h3>
           <div className="space-y-4 max-h-64 overflow-y-auto">
              {attendance.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).slice(0, 8).map(record => {
                 const actor = users.find(u => u.id === record.userId);
                 return (
                   <div key={record.id} className="flex items-center text-sm">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3 text-xs font-bold text-gray-600">
                        {actor?.name.charAt(0) || '?'}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{actor?.name}</span>
                        <span className="text-gray-500 mx-1">{record.type === 'check-in' ? 'clocked in' : 'clocked out'}</span>
                      </div>
                      <span className="text-xs text-gray-400">{formatTime(record.timestamp)}</span>
                   </div>
                 )
              })}
           </div>
        </div>
      </div>
    </div>
  );
};

const ApprovalView = ({ users, leaves, updateLeaveStatus }) => {
  const pending = leaves.filter(l => l.status === 'pending');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Pending Approvals</h2>
      <div className="space-y-4">
        {pending.length === 0 && <p className="text-gray-500">No pending requests.</p>}
        {pending.map(request => {
          const requester = users.find(u => u.id === request.userId);
          return (
            <div key={request.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  {requester?.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">{requester?.name}</h4>
                  <p className="text-sm text-indigo-600 font-medium">{request.type}</p>
                  <p className="text-sm text-gray-500">{request.startDate} - {request.endDate}</p>
                  {request.reason && <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">"{request.reason}"</p>}
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => updateLeaveStatus(request.id, 'rejected')}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center"
                >
                  <XCircle className="w-4 h-4 mr-2" /> Reject
                </button>
                <button 
                  onClick={() => updateLeaveStatus(request.id, 'approved')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

// --- Main App Logic ---

export default function App() {
  const [user, setUser] = useState(null); // Auth User
  const [selectedProfile, setSelectedProfile] = useState(null); // App-level User Profile
  const [view, setView] = useState('dashboard');
  
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [tasks, setTasks] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // 1. Initialize Auth & Listeners
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. Data Fetching
  useEffect(() => {
    if (!user) return;

    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(data);
      // Seed initial data if users collection is empty
      if (data.length === 0) seedData(); 
      else setLoading(false);
    }, (err) => console.error("Users listener error:", err));

    const unsubAtt = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.ATTENDANCE), (snap) => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Attendance listener error:", err));

    const unsubLeave = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.LEAVE), (snap) => {
      setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Leave listener error:", err));

    const unsubTasks = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.TASKS), (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Tasks listener error:", err));

    return () => {
      unsubUsers();
      unsubAtt();
      unsubLeave();
      unsubTasks();
    };
  }, [user]);

  // 3. Seed Data (Only runs once if DB is empty)
  const seedData = async () => {
    setSeeding(true);
    const batch = [];
    
    const dummyUsers = [
      { name: 'Sarah Connor', employeeId: 'EMP001', branch: 'New York', position: 'Manager', role: 'manager' },
      { name: 'John Doe', employeeId: 'EMP002', branch: 'New York', position: 'Developer', role: 'employee' },
      { name: 'Jane Smith', employeeId: 'EMP003', branch: 'London', position: 'Designer', role: 'employee' },
      { name: 'Mike Ross', employeeId: 'EMP004', branch: 'London', position: 'Analyst', role: 'employee' },
    ];

    for (const u of dummyUsers) {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), u);
    }
    
    setSeeding(false);
    setLoading(false);
  };

  // 4. Actions
  const handleRecordAttendance = async (type) => {
    if (!selectedProfile) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.ATTENDANCE), {
      userId: selectedProfile.id,
      type,
      timestamp: serverTimestamp()
    });
  };

  const handleAddTask = async (title, dueDate) => {
    if (!selectedProfile) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.TASKS), {
      userId: selectedProfile.id,
      title,
      dueDate, // Store as string YYYY-MM-DD or null
      status: TASK_STATUS.PENDING,
      createdAt: serverTimestamp()
    });
  };

  const handleToggleTask = async (task) => {
    const newStatus = task.status === TASK_STATUS.PENDING ? TASK_STATUS.COMPLETED : TASK_STATUS.PENDING;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.TASKS, task.id), {
      status: newStatus
    });
  };

  const handleSubmitLeave = async (data) => {
    if (!selectedProfile) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.LEAVE), {
      userId: selectedProfile.id,
      ...data,
      status: 'pending',
      createdAt: serverTimestamp()
    });
  };

  const handleUpdateLeaveStatus = async (id, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.LEAVE, id), { status });
  };

  const handleAddUser = async (userData) => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), userData);
  };

  const handleDeleteUser = async (userId) => {
    // Note: In a real production app, you might also want to cleanup the user's tasks/attendance, 
    // but for this demo, we just remove the user profile.
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, userId));
  };

  // 5. Render Logic
  if (loading) return <div className="flex h-screen items-center justify-center bg-indigo-50 text-indigo-600">Loading Platform...</div>;

  if (!selectedProfile) return <LoginScreen users={users} onLogin={(u) => {
    setSelectedProfile(u);
    // Default view logic: Managers go to Overview, Employees to Dashboard
    setView(u.role === 'manager' ? 'manager_overview' : 'dashboard');
  }} seeding={seeding} />;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar 
        user={selectedProfile} 
        activeTab={view} 
        setActiveTab={setView} 
        onLogout={() => {
          setSelectedProfile(null);
          setView('dashboard');
        }} 
      />
      
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {selectedProfile.role === 'manager' && (
            <>
              {view === 'manager_overview' && <ManagerDashboard users={users} attendance={attendance} leaves={leaves} onNavigate={setView} />}
              {view === 'manager_stats' && <ManagerStatsView users={users} attendance={attendance} leaves={leaves} tasks={tasks} />} 
              {view === 'employees' && <EmployeesList users={users} attendance={attendance} leaves={leaves} tasks={tasks} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser} />}
              {view === 'daily_status' && <DailyStatusView users={users} attendance={attendance} />}
              {view === 'employee_tasks' && <ManagerTaskView users={users} tasks={tasks} />}
              {view === 'approvals' && <ApprovalView users={users} leaves={leaves} updateLeaveStatus={handleUpdateLeaveStatus} />}
            </>
          )}

          {view === 'dashboard' && <EmployeeDashboard user={selectedProfile} attendance={attendance} tasks={tasks} leaves={leaves} onNavigate={setView} />}
          {view === 'attendance' && <AttendanceView user={selectedProfile} recordAttendance={handleRecordAttendance} attendance={attendance} />}
          {view === 'tasks' && <TaskView user={selectedProfile} tasks={tasks} addTask={handleAddTask} toggleTask={handleToggleTask} />}
          {view === 'leave' && <LeaveView user={selectedProfile} leaves={leaves} submitLeave={handleSubmitLeave} />}
        </div>
      </main>
    </div>
  );
}