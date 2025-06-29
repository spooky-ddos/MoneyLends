import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Grid,
  Typography,
  Box,
  Button,
  Avatar,
  Paper,
  Skeleton,
  TextField
} from '@mui/material';
import {
  Person as PersonIcon,
  AccountBalance as AccountBalanceIcon,
  ArrowForward as ArrowForwardIcon,
  PersonAdd as PersonAddIcon,
  Summarize as SummarizeIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion } from 'framer-motion';
import GroupPayment from './GroupPayment';

function LoadingState() {
  return (
    <Box sx={{ padding: { xs: '1rem', sm: '2rem', md: '3rem' } }}>
      <Skeleton variant="text" width="200px" height={40} sx={{ mb: 4 }} />
      <Grid container spacing={3}>
        {[1, 2, 3].map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item}>
            <Skeleton
              variant="rounded"
              height={200}
              sx={{
                transform: 'none',
                animation: 'pulse 1.5s ease-in-out 0.5s infinite'
              }}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function Dashboard() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openGroupPayment, setOpenGroupPayment] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPeople = async () => {
      if (!auth.currentUser) return;

      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const peopleCollection = collection(db, 'users', auth.currentUser.uid, 'people');
        const peopleSnapshot = await getDocs(peopleCollection);
        const peopleList = peopleSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
        setPeople(peopleList);
      } finally {
        setLoading(false);
      }
    };
    fetchPeople();
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  const filteredPeople = people.filter(person =>
    person.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      sx={{
        padding: { xs: '0.5rem', sm: '1rem', md: '2rem', lg: '3rem' },
        maxWidth: '1400px',
        margin: '0 auto',
        overflow: 'hidden'
      }}
    >
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 4,
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2
      }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            textAlign: { xs: 'center', sm: 'left' }
          }}
        >
          Lista Pozycji
        </Typography>

        <TextField
          size="small"
          label="Szukaj pozycji"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{
            width: { xs: '100%', sm: '300px' },
            backgroundColor: 'white',
            borderRadius: 1
          }}
        />
      </Box>

      {filteredPeople.length === 0 ? (
        <Paper
          component={motion.div}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          sx={{
            p: 4,
            textAlign: 'center',
            backgroundColor: 'var(--paper-background)',
            borderRadius: 2,
            color: 'var(--text-color)'
          }}
        >
          <Typography variant="h6" gutterBottom color="text.secondary">
            Nie masz jeszcze żadnych pozycji
          </Typography>
          <Button
            component={Link}
            to="/dodaj-osobe"
            variant="contained"
            startIcon={<PersonAddIcon />}
            sx={{
              mt: 2,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)'
              }
            }}
          >
            Dodaj Pierwszą Pozycję
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredPeople.map((person) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={person.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s',
                  backgroundColor: '#ffffff',
                  color: 'rgb(30, 41, 59)',
                  boxShadow: 'var(--box-shadow)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 'var(--box-shadow)',
                    backgroundColor: '#ffffff'
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: person.isSummary ? 'info.main' : 'primary.main', mr: 2 }}>
                      {person.isSummary ? <SummarizeIcon /> : <PersonIcon />}
                    </Avatar>
                    <Typography variant="h6" component="h2">
                      {person.name}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <AccountBalanceIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      {person.isSummary ? 'Suma wydatków' : 'Całkowity dług'}: {new Intl.NumberFormat('pl-PL', {
                        style: 'currency',
                        currency: 'PLN'
                      }).format(person.totalDebt || 0)}
                    </Typography>
                  </Box>

                  {person.phoneNumber && (
                    <Typography variant="body2" color="text.secondary">
                      Tel: {person.phoneNumber}
                    </Typography>
                  )}

                  {person.email && (
                    <Typography variant="body2" color="text.secondary">
                      Email: {person.email}
                    </Typography>
                  )}
                </CardContent>

                <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                  <Button
                    component={Link}
                    to={`/osoba/${person.id}`}
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    sx={{
                      bgcolor: 'primary.main',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      }
                    }}
                  >
                    Szczegóły
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      <GroupPayment
        open={openGroupPayment}
        onClose={() => setOpenGroupPayment(false)}
      />
    </Box>
  );
}

export default Dashboard;