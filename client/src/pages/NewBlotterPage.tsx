import React from 'react';
import { useNavigate } from 'react-router-dom';
import BlotterFormModal from '../components/blotter/BlotterFormModal';

export const NewBlotterPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <BlotterFormModal
      isOpen={true}
      onClose={() => navigate('/blotter')}
      onSuccess={() => navigate('/blotter')}
    />
  );
};

export default NewBlotterPage;
