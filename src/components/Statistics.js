import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Box, Paper, Typography, Grid, ToggleButtonGroup, ToggleButton, Skeleton } from '@mui/material';
import { motion } from 'framer-motion';
import { Pie, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement as ChartJsLineElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  ChartJsLineElement
);

function LoadingState() {
  return (
    <Box sx={{ padding: { xs: '1rem', sm: '2rem' } }}>
      <Skeleton variant="text" width="200px" height={40} sx={{ mb: 4 }} />
      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <Skeleton 
            variant="rounded" 
            height={300}
            sx={{ 
              transform: 'none',
              animation: 'pulse 1.5s ease-in-out 0.5s infinite'
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Skeleton 
            variant="rounded" 
            height={300}
            sx={{ 
              transform: 'none',
              animation: 'pulse 1.5s ease-in-out 0.5s infinite'
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Skeleton 
            variant="rounded" 
            height={300}
            sx={{ 
              transform: 'none',
              animation: 'pulse 1.5s ease-in-out 0.5s infinite'
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Skeleton 
            variant="rounded" 
            height={300}
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

function Statistics() {
  const [people, setPeople] = useState([]);
  const [totalDebt, setTotalDebt] = useState(0);
  const [paymentStats, setPaymentStats] = useState({ cash: 0, bank: 0 });
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const peopleCollection = collection(db, 'users', auth.currentUser.uid, 'people');
        const peopleSnapshot = await getDocs(peopleCollection);
        const peopleList = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(person => !person.isSummary);
        
        setPeople(peopleList);
        
        const total = peopleList.reduce((sum, person) => sum + (person.totalDebt || 0), 0);
        setTotalDebt(total);
        
        const paymentMethods = { cash: 0, bank: 0 };
        peopleList.forEach(person => {
          person.transactions?.forEach(transaction => {
            if (transaction.type === 'repayment') {
              if (transaction.method === 'Gotówka') {
                paymentMethods.cash += 1;
              } else if (transaction.method === 'Konto') {
                paymentMethods.bank += 1;
              }
            }
          });
        });
        setPaymentStats(paymentMethods);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  const sortedDebtors = [...people]
    .sort((a, b) => {
      const comparison = (b.totalDebt || 0) - (a.totalDebt || 0);
      return sortOrder === 'desc' ? comparison : -comparison;
    })
    .slice(0, 4);

  const calculateAverageRepaymentTime = (peopleList) => {
    const personAverages = [];

    peopleList.forEach(person => {
      const sortedTransactions = [...(person.transactions || [])].sort(
        (a, b) => a.date.toDate() - b.date.toDate()
      );

      const debts = sortedTransactions.filter(t => t.type === 'debt');
      let availableRepayments = [...sortedTransactions.filter(t => t.type === 'repayment')];
      let totalDays = 0;
      let fullyRepaidCount = 0;

      for (const debt of debts) {
        let remainingDebt = debt.amount;
        let repaymentDates = [];

        while (remainingDebt > 0 && availableRepayments.length > 0) {
          const repayment = availableRepayments[0];
          const repaymentAmount = Math.min(remainingDebt, repayment.amount);
          
          remainingDebt -= repaymentAmount;
          repaymentDates.push(repayment.date.toDate());
          
          if (repaymentAmount < repayment.amount) {
            availableRepayments[0] = {
              ...repayment,
              amount: repayment.amount - repaymentAmount
            };
          } else {
            availableRepayments.shift();
          }
        }

        if (remainingDebt === 0) {
          const lastRepaymentDate = new Date(Math.max(...repaymentDates));
          const diffTime = Math.abs(lastRepaymentDate - debt.date.toDate());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          totalDays += diffDays;
          fullyRepaidCount++;
        }
      }

      if (fullyRepaidCount > 0) {
        personAverages.push(totalDays / fullyRepaidCount);
      }
    });

    return personAverages.length > 0 
      ? Math.round(personAverages.reduce((sum, avg) => sum + avg, 0) / personAverages.length)
      : 0;
  };

  const getOldestUnpaidDebt = (peopleList) => {
    let oldestDebt = null;
    let oldestDebtPerson = null;

    peopleList.forEach(person => {
      const sortedTransactions = [...(person.transactions || [])].sort(
        (a, b) => a.date.toDate() - b.date.toDate()
      );

      const debts = sortedTransactions.filter(t => t.type === 'debt');
      let totalRepayments = sortedTransactions
        .filter(t => t.type === 'repayment')
        .reduce((sum, t) => sum + t.amount, 0);

      for (const debt of debts) {
        if (totalRepayments >= debt.amount) {
          totalRepayments -= debt.amount;
          continue;
        }

        const remainingDebt = debt.amount - totalRepayments;
        totalRepayments = 0;

        if (!oldestDebt || debt.date.toDate() < oldestDebt.date.toDate()) {
          oldestDebt = {
            ...debt,
            remainingAmount: remainingDebt
          };
          oldestDebtPerson = person;
        }
      }
    });

    return oldestDebt && oldestDebtPerson ? {
      person: oldestDebtPerson.name,
      amount: oldestDebt.remainingAmount,
      date: oldestDebt.date.toDate(),
      description: oldestDebt.description
    } : null;
  };

  const getTotalDebtChartData = () => {
    if (!people.length) return { labels: [], datasets: [] };

    const allTransactions = people.flatMap(person => 
      (person.transactions || []).map(t => ({
        ...t,
        date: t.date.toDate()
      }))
    );

    const sortedTransactions = allTransactions.sort((a, b) => a.date - b.date);

    let balance = 0;
    const data = sortedTransactions.map(t => {
      balance += t.type === 'debt' ? t.amount : -t.amount;
      return {
        date: t.date,
        balance
      };
    });

    return {
      labels: data.map(d => d.date.toLocaleDateString('pl-PL')),
      datasets: [
        {
          label: 'Całkowite zadłużenie',
          data: data.map(d => d.balance),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
          fill: false
        }
      ]
    };
  };

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
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        Statystyki
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Paper elevation={3} sx={{ 
              p: 3, 
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderTop: 3,
              borderColor: 'primary.main',
              position: 'relative',
              overflow: 'hidden',
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
                zIndex: 1
              }}>
                Podsumowanie
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2,
                position: 'relative',
                zIndex: 1
              }}>
                <Typography variant="body1">
                  Liczba osób: {people.length}
                </Typography>
                <Typography variant="body1">
                  Całkowita kwota długów: {new Intl.NumberFormat('pl-PL', {
                    style: 'currency',
                    currency: 'PLN'
                  }).format(totalDebt)}
                </Typography>
                <Typography variant="body1">
                  Średni czas spłaty: {calculateAverageRepaymentTime(people)} dni
                </Typography>
              </Box>
            </Paper>

            <Paper elevation={3} sx={{ 
              p: 3, 
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderTop: 3,
              borderColor: 'error.main',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                width: '30%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(211, 47, 47, 0.05))',
                zIndex: 0
              }
            }}>
              <Typography variant="h6" gutterBottom sx={{ 
                color: 'error.main',
                fontWeight: 'medium',
                position: 'relative',
                zIndex: 1
              }}>
                Najstarszy niespłacony dług
              </Typography>
              {getOldestUnpaidDebt(people) ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      Osoba: {getOldestUnpaidDebt(people).person}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      Kwota: {new Intl.NumberFormat('pl-PL', {
                        style: 'currency',
                        currency: 'PLN'
                      }).format(getOldestUnpaidDebt(people).amount)}
                    </Typography>
                    <Typography variant="body1">
                      Data: {getOldestUnpaidDebt(people).date.toLocaleDateString('pl-PL')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Opis: {getOldestUnpaidDebt(people).description}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body1">Brak niespłaconych długów</Typography>
              )}
            </Paper>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%' 
          }}>
            <Paper elevation={3} sx={{ 
              p: 3, 
              backgroundColor: 'rgba(255,255,255,0.9)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              flex: 1,
              borderTop: 3,
              borderColor: sortOrder === 'desc' ? 'error.main' : 'success.main',
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
                  sortOrder === 'desc' 
                    ? 'rgba(211, 47, 47, 0.05)'
                    : 'rgba(76, 175, 80, 0.05)'
                })`,
                zIndex: 0
              }
            }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 3,
                position: 'relative',
                zIndex: 1
              }}>
                <Typography variant="h6" sx={{ 
                  color: sortOrder === 'desc' ? 'error.main' : 'success.main',
                  fontWeight: 'medium'
                }}>
                  Osoby
                </Typography>
                <ToggleButtonGroup
                  value={sortOrder}
                  exclusive
                  onChange={(e, newValue) => newValue && setSortOrder(newValue)}
                  size="small"
                >
                  <ToggleButton value="desc">
                    Malejąco
                  </ToggleButton>
                  <ToggleButton value="asc">
                    Rosnąco
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Box sx={{ 
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                overflow: 'auto'
              }}>
                {sortedDebtors.map((person, index) => (
                  <Box 
                    key={person.id} 
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      p: 2,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      boxShadow: 1,
                      border: 1,
                      borderColor: index === 0 
                        ? (sortOrder === 'desc' ? 'error.main' : 'success.main') 
                        : 'divider',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        boxShadow: 2,
                        borderColor: index === 0 
                          ? (sortOrder === 'desc' ? 'error.main' : 'success.main')
                          : 'primary.main',
                        bgcolor: 'action.hover'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography 
                        sx={{ 
                          width: 28, 
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: index === 0 
                            ? (sortOrder === 'desc' ? 'error.main' : 'success.main')
                            : 'primary.main',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold'
                        }}
                      >
                        {index + 1}
                      </Typography>
                      <Typography>{person.name}</Typography>
                    </Box>
                    <Typography 
                      color={index === 0 
                        ? (sortOrder === 'desc' ? 'error.main' : 'success.main')
                        : 'text.primary'} 
                      fontWeight="medium"
                    >
                      {new Intl.NumberFormat('pl-PL', {
                        style: 'currency',
                        currency: 'PLN'
                      }).format(person.totalDebt || 0)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Box>
        </Grid>

        <Grid item xs={12} container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ 
              p: 3, 
              backgroundColor: 'rgba(255,255,255,0.9)',
              minHeight: '300px',
              borderTop: 3,
              borderColor: 'primary.main',
              position: 'relative',
              overflow: 'hidden',
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
                textAlign: 'center',
                position: 'relative',
                zIndex: 1
              }}>
                Metody Spłat
              </Typography>
              <Box sx={{ height: '220px', position: 'relative', zIndex: 1 }}>
                <Pie 
                  data={{
                    labels: ['Gotówka', 'Konto'],
                    datasets: [{
                      data: [paymentStats.cash, paymentStats.bank],
                      backgroundColor: ['#4caf50', '#1976d2'],
                      borderColor: ['#43a047', '#1565c0'],
                      borderWidth: 1,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { 
                        position: 'top',
                        padding: 10
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const total = paymentStats.cash + paymentStats.bank;
                            if (total === 0) return `${context.label}: 0%`;
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${percentage}%`;
                          }
                        }
                      }
                    }
                  }}
                />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ 
              p: 3, 
              backgroundColor: 'rgba(255,255,255,0.9)',
              minHeight: '300px',
              borderTop: 3,
              borderColor: 'success.main',
              position: 'relative',
              overflow: 'hidden',
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
                textAlign: 'center',
                position: 'relative',
                zIndex: 1
              }}>
                Historia zadłużenia
              </Typography>
              <Box sx={{ height: '220px', position: 'relative', zIndex: 1 }}>
                <Line
                  data={getTotalDebtChartData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        min: 0,
                        grid: {
                          color: 'rgba(76, 175, 80, 0.1)'
                        }
                      },
                      x: {
                        grid: {
                          color: 'rgba(76, 175, 80, 0.1)'
                        }
                      }
                    }
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Statistics;