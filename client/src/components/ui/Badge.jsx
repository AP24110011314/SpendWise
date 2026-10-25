const Badge = ({ children, variant = 'gray', className = '', ...props }) => {
  const variants = {
    green: 'badge-green',
    amber: 'badge-amber',
    red: 'badge-red',
    blue: 'badge-blue',
    gray: 'badge-gray',
  };

  return (
    <span className={`${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};

export default Badge;