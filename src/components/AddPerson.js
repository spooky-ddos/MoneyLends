import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { TextField, Button, Paper, Typography, Box } from '@mui/material';
import { motion } from 'framer-motion';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

function AddPerson() {
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    await addDoc(collection(db, 'users', auth.currentUser.uid, 'people'), {
      name,
      createdAt: new Date(),
      transactions: []
    });
    navigate('/');
  };

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      sx={{
        maxWidth: '600px',
        width: { xs: '95%', sm: '100%' },
        margin: '2rem auto',
        padding: { xs: '0.5rem', sm: '2rem' }
      }}
    >
      <Paper elevation={3} sx={{
        padding: '2rem',
        backgroundColor: 'rgba(255,255,255,0.9)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Button
            component={Link}
            to="/"
            variant="outlined"
            startIcon={<ArrowBackIcon />}
          >
            Powrót
          </Button>
          <Typography variant="h5">
            Dodaj Nową Osobę
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Imię i Nazwisko"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            sx={{ mb: 3 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.02)'
              }
            }}
          >
            Dodaj Osobę
          </Button>
        </form>
      </Paper>
    </Box>
  );
}

export default AddPerson;