import React, { useEffect, useRef } from 'react';

const ParticleNetwork: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    
    // Resize observer
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle settings
    const particleCount = 80;
    const particles: { x: number; y: number; vx: number; vy: number }[] = [];
    const connectionDistance = 150;
    const mouseParams = { x: -1000, y: -1000, radius: 200 };

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5
      });
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseParams.x = e.clientX - rect.left;
      mouseParams.y = e.clientY - rect.top;
    };
    window.addEventListener('mousemove', onMouseMove);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Update particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off walls
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Mouse interaction
        const dx = mouseParams.x - p.x;
        const dy = mouseParams.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < mouseParams.radius) {
            const angle = Math.atan2(dy, dx);
            const force = (mouseParams.radius - distance) / mouseParams.radius;
            const pushX = Math.cos(angle) * force * 2.0; // Push strength
            const pushY = Math.sin(angle) * force * 2.0; 
            
            p.x -= pushX;
            p.y -= pushY;
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'; // Blue-500
        ctx.fill();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(59, 130, 246, ${1 - dist / connectionDistance})`;
            ctx.lineWidth = 1;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Connect to mouse
        particles.forEach(p => {
            const dx = mouseParams.x - p.x;
            const dy = mouseParams.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

             if (dist < mouseParams.radius) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - dist / mouseParams.radius)})`;
                ctx.lineWidth = 1;
                ctx.moveTo(mouseParams.x, mouseParams.y);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
             }
        })

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />;
};

export default ParticleNetwork;
