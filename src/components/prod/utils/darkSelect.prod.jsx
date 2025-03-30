import React from 'react';
import Select from 'react-select';

const CustomSelect = ({ options, value, onChange, placeholder }) => {
    const customStyles = {
        control: (base) => ({
            ...base,
            backgroundColor: '#2a2d2e',
            border: '1px solid #3a3d3e',
            borderRadius: '0px',
            minHeight: '22px', // Соответствует высоте оригинального select
            boxShadow: 'none',
            '&:hover': {
                borderColor: '#4a4d4e'
            }
        }),
        menu: (base) => ({
            ...base,
            backgroundColor: '#2a2d2e',
            position: 'absolute',
            width: '100%',
            maxHeight: 'none !important', // Убираем ограничение по высоте
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
            border: '1px solid #3a3d3e',
            borderRadius: '0px',
            marginTop: '2px',
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isFocused ? '#353839' : '#2a2d2e',
            color: '#d9d7d4',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '4px 16px',
            '&:active': {
                backgroundColor: '#404344'
            }
        }),
        singleValue: (base) => ({
            ...base,
            color: '#d9d7d4',
            fontSize: '11px'
        }),
        placeholder: (base) => ({
            ...base,
            color: '#7a7a7a',
            fontSize: '11px'
        }),
        dropdownIndicator: (base) => ({
            ...base,
            padding: '1px',
            color: '#7a7a7a',
            '&:hover': {
                color: '#d9d7d4'
            }
        }),
        indicatorSeparator: () => ({
            display: 'none'
        }),
        input: (base) => ({
            ...base,
            color: '#d9d7d4',
            fontSize: '11px'
        }),
        menuList: (base) => ({
            ...base,
            maxHeight: 'none !important',
            overflow: 'visible !important',
            padding: 0,
            '::-webkit-scrollbar': {
                width: '8px'
            },
            '::-webkit-scrollbar-track': {
                background: '#2a2d2e'
            },
            '::-webkit-scrollbar-thumb': {
                background: '#3a3d3e',
                borderRadius: '4px'
            }
        })
    };

    return (
        <Select
            styles={customStyles}
            options={options}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            isSearchable={false}
            components={{
                IndicatorSeparator: null
            }}
        // theme={theme => ({
        //     ...theme,
        //     colors: {
        //         ...theme.colors,
        //         primary: '#5a5d5e', // Цвет фокуса
        //         primary25: '#353839', // Ховер состояния
        //         neutral0: '#2a2d2e', // Основной фон
        //         neutral80: '#d9d7d4' // Цвет текста
        //     }
        // })}
        />
    );
};

export default CustomSelect;