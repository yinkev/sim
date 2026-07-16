import type { SVGProps } from 'react'

export function AgentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width='21'
      height='24'
      viewBox='0 0 21 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M15.67 9.25H4.67C2.64 9.25 1 10.89 1 12.92V18.42C1 20.44 2.64 22.08 4.67 22.08H15.67C17.69 22.08 19.33 20.44 19.33 18.42V12.92C19.33 10.89 17.69 9.25 15.67 9.25Z'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M10.17 5.58C11.18 5.58 12 4.76 12 3.75C12 2.74 11.18 1.92 10.17 1.92C9.15 1.92 8.33 2.74 8.33 3.75C8.33 4.76 9.15 5.58 10.17 5.58Z'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M10.17 5.59V9.25M7.42 16.59V14.75M12.92 14.75V16.59'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

export function ImageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width='26'
      height='26'
      viewBox='0 0 26 26'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M24.9 10.32C16.09 9.11 8.49 15.65 9 24.33M5.67 7.67C5.67 8.37 5.95 9.05 6.45 9.55C6.95 10.05 7.63 10.33 8.33 10.33C9.04 10.33 9.72 10.05 10.22 9.55C10.72 9.05 11 8.37 11 7.67C11 6.96 10.72 6.28 10.22 5.78C9.72 5.28 9.04 5 8.33 5C7.63 5 6.95 5.28 6.45 5.78C5.95 6.28 5.67 6.96 5.67 7.67Z' />
      <path d='M1 14.42C4.71 13.91 8.03 15.7 9.83 18.55' />
      <path d='M1 9.53C1 6.55 1 5.05 1.58 3.91C2.09 2.91 2.91 2.09 3.91 1.58C5.05 1 6.55 1 9.53 1H16.47C19.45 1 20.95 1 22.09 1.58C23.09 2.09 23.91 2.91 24.42 3.91C25 5.05 25 6.55 25 9.53V16.47C25 19.45 25 20.95 24.42 22.09C23.91 23.09 23.09 23.91 22.09 24.42C20.95 25 19.45 25 16.47 25H9.53C6.55 25 5.05 25 3.91 24.42C2.91 23.91 2.09 23.09 1.58 22.09C1 20.95 1 19.45 1 16.47V9.53Z' />
    </svg>
  )
}

export function TTSIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M2 10v3' />
      <path d='M6 6v11' />
      <path d='M10 3v18' />
      <path d='M14 8v7' />
      <path d='M18 5v13' />
      <path d='M22 10v3' />
    </svg>
  )
}

export function VideoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='m16 13 5.22 3.48a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5' />
      <rect x='2' y='6' width='14' height='12' rx='2' />
    </svg>
  )
}
