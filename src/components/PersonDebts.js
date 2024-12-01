import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { 
  TextField, 
  Button, 
  Paper, 
  Typography, 
  Box,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  Grid,
  Skeleton
} from '@mui/material';
import { Add as AddIcon, Payment as PaymentIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { Grow } from '@mui/material';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function LoadingState() {
  return (
    <Box 
      sx={{ 
        maxWidth: '1400px',
        width: { xs: '95%', sm: '100%' },
        margin: '2rem auto',
        padding: { xs: '0.5rem', sm: '2rem' }
      }}
    >
      <Skeleton 
        variant="rounded" 
        height={200}
        sx={{ 
          mb: 3,
          transform: 'none',
          animation: 'pulse 1.5s ease-in-out 0.5s infinite'
        }}
      />
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Skeleton 
            variant="rounded" 
            height={400}
            sx={{ 
              transform: 'none',
              animation: 'pulse 1.5s ease-in-out 0.5s infinite'
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Skeleton 
            variant="rounded" 
            height={400}
            sx={{ 
              transform: 'none',
              animation: 'pulse 1.5s ease-in-out 0.5s infinite'
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

function PersonDebts() {
  const { id } = useParams();
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openDebtDialog, setOpenDebtDialog] = useState(false);
  const [openRepaymentDialog, setOpenRepaymentDialog] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'debts', 'repayments', 'all'
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const navigate = useNavigate();
  
  const [newDebt, setNewDebt] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
  
  const [newRepayment, setNewRepayment] = useState({
    amount: '',
    method: 'Gotówka',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [openTransactionDeleteDialog, setOpenTransactionDeleteDialog] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const docRef = doc(db, 'users', auth.currentUser.uid, 'people', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPerson({ id: docSnap.id, ...docSnap.data() });
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  const handleAddDebt = async () => {
    const debtToAdd = {
      type: 'debt',
      ...newDebt,
      amount: parseFloat(newDebt.amount),
      date: new Date(newDebt.date),
      timestamp: new Date()
    };

    const updatedTransactions = [...(person.transactions || []), debtToAdd];
    const newTotalDebt = (person.totalDebt || 0) + debtToAdd.amount;

    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'people', id), {
      transactions: updatedTransactions,
      totalDebt: newTotalDebt
    });

    setOpenDebtDialog(false);
    refreshPersonData();
  };

  const handleAddRepayment = async () => {
    const repaymentToAdd = {
      type: 'repayment',
      ...newRepayment,
      amount: parseFloat(newRepayment.amount),
      date: new Date(newRepayment.date),
      timestamp: new Date()
    };

    const updatedTransactions = [...(person.transactions || []), repaymentToAdd];
    const newTotalDebt = (person.totalDebt || 0) - repaymentToAdd.amount;

    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'people', id), {
      transactions: updatedTransactions,
      totalDebt: newTotalDebt
    });

    setOpenRepaymentDialog(false);
    refreshPersonData();
  };

  const refreshPersonData = async () => {
    const docRef = doc(db, 'users', auth.currentUser.uid, 'people', id);
    const docSnap = await getDoc(docRef);
    setPerson({ id: docSnap.id, ...docSnap.data() });
  };

  const getFilteredTransactions = () => {
    if (!person?.transactions) return [];
    let transactions;
    switch (viewMode) {
      case 'debts':
        transactions = person.transactions.filter(t => t.type === 'debt');
        break;
      case 'repayments':
        transactions = person.transactions.filter(t => t.type === 'repayment');
        break;
      default:
        transactions = person.transactions;
    }
    // Sortowanie po dacie (od najnowszych)
    return transactions.sort((a, b) => b.date.toDate() - a.date.toDate());
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'people', id));
      navigate('/');
    } catch (error) {
      console.error('Błąd podczas usuwania:', error);
    }
  };

  const getChartData = () => {
    if (!person?.transactions) return { labels: [], datasets: [] };

    const sortedTransactions = [...person.transactions].sort((a, b) => 
      a.date.toDate() - b.date.toDate()
    );

    let balance = 0;
    const data = sortedTransactions.map(t => {
      balance += t.type === 'debt' ? t.amount : -t.amount;
      return {
        date: t.date.toDate(),
        balance
      };
    });

    return {
      labels: data.map(d => d.date.toLocaleDateString('pl-PL')),
      datasets: [
        {
          label: 'Saldo zadłużenia',
          data: data.map(d => d.balance),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }
      ]
    };
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;

    const updatedTransactions = person.transactions.filter((t, index) => index !== transactionToDelete.index);
    const amountChange = transactionToDelete.transaction.type === 'debt' 
      ? -transactionToDelete.transaction.amount 
      : transactionToDelete.transaction.amount;
    
    const newTotalDebt = (person.totalDebt || 0) + amountChange;

    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'people', id), {
      transactions: updatedTransactions,
      totalDebt: newTotalDebt
    });

    setOpenTransactionDeleteDialog(false);
    setTransactionToDelete(null);
    refreshPersonData();
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <Box 
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      sx={{ 
        maxWidth: '1400px',
        width: { xs: '95%', sm: '100%' },
        margin: '2rem auto',
        padding: { xs: '0.5rem', sm: '2rem' }
      }}
    >
      {/* Sekcja 1: Nawigacja, akcje i podsumowanie */}
      <Paper elevation={3} sx={{ 
        padding: '2rem', 
        mb: 3,
        backgroundColor: '#ffffff',
        color: 'rgb(30, 41, 59)',
        borderTop: 3,
        borderColor: person.totalDebt > 0 ? 'error.main' : 'success.main',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: '30%',
          height: '100%',
          background: `linear-gradient(90deg, transparent, ${
            person.totalDebt > 0 
              ? 'rgba(211, 47, 47, 0.05)'
              : 'rgba(76, 175, 80, 0.05)'
          })`,
          zIndex: 0
        }
      }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                component={Link}
                to="/"
                variant="outlined"
                sx={{ minWidth: 'auto' }}
              >
                ← Powrót
              </Button>
              <Typography variant="h5">{person.name}</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'center',
              p: 2,
              borderRadius: 1,
              border: 1,
              borderColor: person.totalDebt > 0 ? 'error.main' : 'success.main',
              color: person.totalDebt > 0 ? 'error.main' : 'success.main',
              bgcolor: person.totalDebt > 0 ? 'error.50' : 'success.50'
            }}>
              <Typography variant="subtitle1" fontWeight="medium">
                Dług: {new Intl.NumberFormat('pl-PL', {
                  style: 'currency',
                  currency: 'PLN'
                }).format(person.totalDebt || 0)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ 
              display: 'flex', 
              gap: 1,
              justifyContent: 'flex-end'
            }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenDebtDialog(true)}
                size="small"
              >
                Dodaj Dług
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<PaymentIcon />}
                onClick={() => setOpenRepaymentDialog(true)}
                size="small"
              >
                Dodaj Spłatę
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setOpenDeleteDialog(true)}
                size="small"
              >
                Usuń
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' }, 
        gap: 3,
        width: '100%',
        alignItems: { xs: 'center', md: 'stretch' }
      }}>
        {/* Lewa kolumna - Historia transakcji */}
        <Paper elevation={3} sx={{ 
          padding: { xs: '1rem', sm: '2rem' },
          width: { xs: '95%', md: '60%' },
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderTop: 3,
          borderColor: 'primary.main',
          position: 'relative',
          overflow: 'hidden',
          height: '500px',
          display: 'flex',
          flexDirection: 'column',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: '30%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(25, 118, 210, 0.05))',
            zIndex: 0
          }
        }}>
          <Typography variant="h6" gutterBottom sx={{ 
            color: 'primary.main',
            fontWeight: 'medium',
            position: 'relative',
            zIndex: 1,
            fontSize: { xs: '1.1rem', sm: '1.25rem' }
          }}>
            Historia transakcji
          </Typography>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newValue) => setViewMode(newValue)}
            sx={{ 
              mb: 3,
              flexWrap: 'wrap',
              '& .MuiToggleButton-root': {
                padding: { xs: '6px 12px', sm: '8px 16px' },
                fontSize: { xs: '0.8rem', sm: '0.875rem' }
              }
            }}
          >
            <ToggleButton value="all">Wszystko</ToggleButton>
            <ToggleButton value="debts">Długi</ToggleButton>
            <ToggleButton value="repayments">Spłaty</ToggleButton>
          </ToggleButtonGroup>
          <List sx={{ 
            overflow: 'auto',
            flex: 1,
            maxHeight: '350px',
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.3)',
              },
            },
          }}>
            {getFilteredTransactions().map((transaction, index) => (
              <ListItem
                key={index}
                sx={{ 
                  padding: { xs: '4px 8px', sm: '8px 16px' },
                  '& .MuiTypography-root': {
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }
                }}
                secondaryAction={
                  <IconButton 
                    edge="end" 
                    aria-label="delete"
                    onClick={() => {
                      setTransactionToDelete({ transaction, index });
                      setOpenTransactionDeleteDialog(true);
                    }}
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={
                    <Typography color={transaction.type === 'debt' ? 'error' : 'success'}>
                      {transaction.type === 'debt' ? '-' : '+'} 
                      {new Intl.NumberFormat('pl-PL', { 
                        style: 'currency', 
                        currency: 'PLN' 
                      }).format(transaction.amount)}
                      {transaction.type === 'repayment' && ` (${transaction.method})`}
                    </Typography>
                  }
                  secondary={`${transaction.description} - ${transaction.date.toDate().toLocaleDateString('pl-PL')}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Prawa kolumna - wykres */}
        <Paper elevation={3} sx={{ 
          padding: { xs: '1rem', sm: '2rem' },
          width: { xs: '95%', md: '40%' },
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderTop: 3,
          borderColor: 'success.main',
          position: 'relative',
          overflow: 'hidden',
          height: '500px',
          display: 'flex',
          flexDirection: 'column',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: '30%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(76, 175, 80, 0.05))',
            zIndex: 0
          }
        }}>
          <Typography variant="h6" gutterBottom sx={{ 
            color: 'success.main',
            fontWeight: 'medium',
            position: 'relative',
            zIndex: 1,
            fontSize: { xs: '1.1rem', sm: '1.25rem' }
          }}>
            Historia zadłużenia
          </Typography>
          <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <Line
              data={getChartData()}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                    labels: {
                      font: {
                        size: window.innerWidth < 600 ? 10 : 12
                      }
                    }
                  },
                  title: {
                    display: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    min: 0,
                    ticks: {
                      font: {
                        size: window.innerWidth < 600 ? 10 : 12
                      }
                    }
                  },
                  x: {
                    ticks: {
                      font: {
                        size: window.innerWidth < 600 ? 8 : 10
                      }
                    }
                  }
                }
              }}
            />
          </Box>
        </Paper>
      </Box>

      {/* Dialog dodawania długu */}
      <Dialog open={openDebtDialog} onClose={() => setOpenDebtDialog(false)}>
        <DialogTitle>Dodaj nowy dług</DialogTitle>
        <DialogContent>
          <TextField
            label="Kwota"
            type="number"
            value={newDebt.amount}
            onChange={(e) => setNewDebt({ ...newDebt, amount: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Opis"
            value={newDebt.description}
            onChange={(e) => setNewDebt({ ...newDebt, description: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Data"
            type="date"
            value={newDebt.date}
            onChange={(e) => setNewDebt({ ...newDebt, date: e.target.value })}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDebtDialog(false)}>Anuluj</Button>
          <Button onClick={handleAddDebt} variant="contained">Dodaj</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog dodawania spłaty */}
      <Dialog open={openRepaymentDialog} onClose={() => setOpenRepaymentDialog(false)}>
        <DialogTitle>Dodaj spłatę</DialogTitle>
        <DialogContent>
          <TextField
            label="Kwota spłaty"
            type="number"
            value={newRepayment.amount}
            onChange={(e) => setNewRepayment({ ...newRepayment, amount: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Opis"
            value={newRepayment.description}
            onChange={(e) => setNewRepayment({ ...newRepayment, description: e.target.value })}
            fullWidth
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel 
              sx={{ 
                '&.MuiInputLabel-shrink': { 
                  bgcolor: 'white',
                  padding: '0 8px',
                }
              }}
            >
              Metoda płatności
            </InputLabel>
            <Select
              value={newRepayment.method}
              onChange={(e) => setNewRepayment({ ...newRepayment, method: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e2e8f0'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e2e8f0'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e2e8f0'
                },
                borderRadius: '0.5rem'
              }}
            >
              <MenuItem value="Gotówka">Gotówka</MenuItem>
              <MenuItem value="Konto">Konto</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Data"
            type="date"
            value={newRepayment.date}
            onChange={(e) => setNewRepayment({ ...newRepayment, date: e.target.value })}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRepaymentDialog(false)}>Anuluj</Button>
          <Button onClick={handleAddRepayment} variant="contained" color="success">
            Dodaj spłatę
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        TransitionComponent={Grow}
        TransitionProps={{ timeout: 500 }}
      >
        <DialogTitle>Potwierdź usunięcie</DialogTitle>
        <DialogContent>
          <Typography>
            Czy na pewno chcesz usunąć {person.name} i wszystkie powiązane transakcje?
            Tej operacji nie można cofnąć.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Anuluj</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Usuń
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openTransactionDeleteDialog}
        onClose={() => setOpenTransactionDeleteDialog(false)}
        TransitionComponent={Grow}
        TransitionProps={{ timeout: 500 }}
      >
        <DialogTitle>Potwierdź usunięcie transakcji</DialogTitle>
        <DialogContent>
          <Typography>
            Czy na pewno chcesz usunąć tę transakcję?
            {transactionToDelete && (
              <>
                <br />
                <strong>
                  {transactionToDelete.transaction.type === 'debt' ? 'Dług' : 'Spłata'}: {' '}
                  {new Intl.NumberFormat('pl-PL', { 
                    style: 'currency', 
                    currency: 'PLN' 
                  }).format(transactionToDelete.transaction.amount)}
                </strong>
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTransactionDeleteDialog(false)}>Anuluj</Button>
          <Button onClick={handleDeleteTransaction} color="error" variant="contained">
            Usuń
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PersonDebts; 